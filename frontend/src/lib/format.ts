export function formatPercent(probability: number, digits = 1): string {
  if (!Number.isFinite(probability)) {
    return "—";
  }
  return `${(probability * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(digits);
}

export function formatLongDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "Date pending";
  }
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(date);
}

export function targetLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Pending";
  }
  return Number(value) === 1 ? "Yes" : "No";
}
