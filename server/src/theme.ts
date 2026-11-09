export interface Theme {
  key: string;
  label: string;
  accent: string;
  background: string;
  scheme: "dark" | "light";
  note: string;
}

export const THEMES: Theme[] = [
  { key: "ember", label: "Ember", accent: "#e9a13c", background: "#16110c", scheme: "dark", note: "Warm black, amber accent. Default theme." },
  { key: "tide", label: "Tide", accent: "#35c9e6", background: "#0b1116", scheme: "dark", note: "Night blue, cyan accent. The coldest of the set." },
  { key: "moss", label: "Moss", accent: "#4c7c39", background: "#edf1e9", scheme: "light", note: "Light, desaturated green." },
  { key: "aurora", label: "Aurora", accent: "#7150c8", background: "#f3f1f8", scheme: "light", note: "Light, lavender white and violet." },
  { key: "paper", label: "Paper", accent: "#7c5c3c", background: "#e8e5df", scheme: "light", note: "Light and neutral, grey and brown." },
];

export const DEFAULT_THEME = "ember";

export function resolveTheme(key: string | undefined): Theme {
  return THEMES.find((theme) => theme.key === key) ?? THEMES[0]!;
}
