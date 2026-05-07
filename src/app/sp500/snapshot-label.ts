export type SnapshotDatedRow = {
  snapshotDate: string | null;
};

export function getSnapshotDateLabel(rows: SnapshotDatedRow[]) {
  const hasUndatedRows = rows.some((row) => !row.snapshotDate);
  const dates = Array.from(
    new Set(
      rows
        .map((row) => row.snapshotDate)
        .filter((date): date is string => Boolean(date))
    )
  ).sort();

  if (dates.length === 0) {
    return "No snapshots";
  }

  if (dates.length === 1) {
    if (hasUndatedRows) {
      return `Mixed snapshots: through ${dates[0]}`;
    }

    return dates[0];
  }

  return `Mixed snapshots: ${dates[0]} to ${dates[dates.length - 1]}`;
}
