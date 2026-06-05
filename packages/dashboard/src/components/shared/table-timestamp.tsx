import {
  formatTableTimestamp,
  formatTimestampTitle,
} from "@/lib/format-timestamp";

export function TableTimestamp({
  value,
}: {
  value: string | null | undefined;
}) {
  if (!value) {
    return <>none</>;
  }

  const label = formatTableTimestamp(value);
  const title = formatTimestampTitle(value);

  return (
    <time className="whitespace-nowrap" dateTime={value} title={title}>
      {label}
    </time>
  );
}
