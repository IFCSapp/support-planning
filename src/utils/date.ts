export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
