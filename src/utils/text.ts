export function ensureJapanesePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return /[。！？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

export function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
