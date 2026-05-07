export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", "-");

  return (
    <span className={`status-pill status-${normalized}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
