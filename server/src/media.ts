import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/** A file supplied by a member must never make ffmpeg open a URL. */
const LIMITS = { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 } as const;
const SAFE_PROTOCOLS = "file,pipe,crypto,data";

export interface ProbeResult {
  duration_s: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate_kbps: number;
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
}

export async function probe(filePath: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-protocol_whitelist",
    SAFE_PROTOCOLS,
    "-show_streams",
    "-show_format",
    "-of",
    "json",
    filePath,
  ], LIMITS);
  const data = JSON.parse(stdout) as {
    streams?: FfprobeStream[];
    format?: { duration?: string; bit_rate?: string };
  };
  const video = data.streams?.find((s) => s.codec_type === "video");
  const parts = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const num = parts[0] ?? 0;
  const den = parts[1] ?? 1;

  return {
    duration_s: Number(data.format?.duration ?? 0),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: den ? Math.round((num / den) * 100) / 100 : 0,
    codec: video?.codec_name ?? "",
    bitrate_kbps: Math.round(Number(data.format?.bit_rate ?? 0) / 1000),
  };
}

export async function extractThumbnail(filePath: string, outPath: string, atSeconds = 1): Promise<void> {
  await run("ffmpeg", [
    "-v",
    "error",
    "-nostdin",
    "-y",
    "-ss",
    String(atSeconds),
    "-i",
    filePath,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "4",
    outPath,
  ], LIMITS);
}
