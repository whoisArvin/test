export default function Loading() {
  return (
    <div className="container page-pad" aria-label="در حال بارگذاری" role="status">
      <div className="skeleton" style={{ height: 80, marginBottom: 24 }} />
      <div className="cards-grid">
        {[1, 2, 3].map((n) => (
          <div className="skeleton" style={{ height: 320 }} key={n} />
        ))}
      </div>
    </div>
  );
}
