function toPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value * 100), 0), 100);
}

export function MethodMix({
  quarterlyWeight,
  fallbackWeight,
  unavailableWeight
}: {
  quarterlyWeight: number | null;
  fallbackWeight: number | null;
  unavailableWeight: number | null;
}) {
  const quarterly = toPercent(quarterlyWeight);
  const fallback = toPercent(fallbackWeight);
  const unavailable = toPercent(unavailableWeight);

  return (
    <div className="method-mix" aria-label="NTM EPS method mix">
      <div className="mix-bar" aria-hidden="true">
        <span
          style={{ width: `${quarterly}%` }}
          className="mix-quarterly"
        />
        <span style={{ width: `${fallback}%` }} className="mix-fallback" />
        <span
          style={{ width: `${unavailable}%` }}
          className="mix-unavailable"
        />
      </div>
      <small>
        {quarterly}% quarterly / {fallback}% fallback / {unavailable}%
        unavailable
      </small>
    </div>
  );
}
