export default function MethodologyPage() {
  return (
    <main className="page-shell flow">
      <h1>Methodology</h1>
      <section>
        <h2>NTM EPS</h2>
        <p>
          The primary method sums the next four unreported quarterly EPS
          consensus estimates. When those estimates are incomplete, the
          fallback blends FY1 and FY2 consensus estimates based on the current
          fiscal-year calendar.
        </p>
      </section>
      <section>
        <h2>Aggregate Forward P/E</h2>
        <p>
          Indexes and ETFs use an earnings-yield weighted calculation from
          constituents: aggregate forward P/E equals one divided by weighted
          constituent earnings yield.
        </p>
      </section>
      <section>
        <h2>Data Source</h2>
        <p>
          This internal prototype uses FMP data for private analysis.
          FMP-sourced and FMP-derived values are not approved for public display
          in this application.
        </p>
      </section>
    </main>
  );
}
