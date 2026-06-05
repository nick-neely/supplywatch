const TIMESTAMP_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
};

const TABLE_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

function parseTimestamp(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  const date = parseTimestamp(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, TIMESTAMP_FORMAT).format(date);
}

export function formatTableTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "none";
  }

  const date = parseTimestamp(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, TABLE_DATE_FORMAT).format(date);
}

export function formatTimestampTitle(
  value: string | null | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = parseTimestamp(value);
  if (!date) {
    return value;
  }

  return formatTimestamp(value);
}
