export function preserveCatalogueScrollRange() {
  const catalogue = document.querySelector<HTMLElement>(".pv-catalogue-layout");
  if (!catalogue) return;
  // Shorter content must still leave enough page height for the current scroll position.
  const surroundingHeight = document.documentElement.scrollHeight - catalogue.getBoundingClientRect().height;
  catalogue.style.minHeight = `${Math.max(0, window.scrollY + window.innerHeight - surroundingHeight)}px`;
}
