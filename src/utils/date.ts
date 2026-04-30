export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function planEndDateFromMonths(startDate: string, months: number): string {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day || months < 1) return "";

  const targetMonthIndex = month - 1 + months;
  const targetMonthLastDay = new Date(year, targetMonthIndex + 1, 0).getDate();
  if (day > targetMonthLastDay) {
    return dateString(new Date(year, targetMonthIndex, targetMonthLastDay));
  }

  return dateString(new Date(year, targetMonthIndex, day - 1));
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
