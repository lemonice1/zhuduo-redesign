export default function Loading() {
  return <main className="container section unavailable" aria-busy="true" aria-live="polite">
    <span className="eyebrow">ZhuDuo</span>
    <h1><span className="loading-en" lang="en">Loading…</span><span className="loading-ar" lang="ar">جارٍ التحميل…</span><span className="loading-fr" lang="fr">Chargement…</span></h1>
  </main>;
}
