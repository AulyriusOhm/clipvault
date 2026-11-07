export function duration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export function bytes(size: number): string {
  if (size < 1024) return `${size} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let value = size / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const rounded = value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
  return `${String(rounded).replace(".", ",")} ${units[i]}`;
}

export function bitrate(kbps: number): string {
  return `${(kbps / 1000).toFixed(1).replace(".", ",")} Mb/s`;
}

export function resolution(width: number, height: number): string {
  return width && height ? `${width}×${height}` : "—";
}

export function relative(iso: string): string {
  const then = new Date(`${iso.replace(" ", "T")}Z`).getTime();
  const diff = Math.max(0, Date.now() - then);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} jours`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return `il y a ${Math.floor(months / 12)} an${months >= 24 ? "s" : ""}`;
}

export function dateLong(iso: string): string {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function dateShort(iso: string): string {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function clock(iso: string): string {
  const d = new Date(`${iso.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}
