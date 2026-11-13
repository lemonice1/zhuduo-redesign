# Whiteboard original-template preview

Independent preview using the actual local `E:\whiteboard-clone` HTML
structure, CSS declarations, fonts and visual animation scripts. The existing
ZHUDUO CMS loaders, taxonomy, product/project galleries, FAQ, language picker,
number animation, inquiry form and Chatbox supply content and behavior.

- `/preview/whiteboard?lang=en`
- `/preview/whiteboard/products?lang=en`
- `/preview/whiteboard/products/expandable-40ft?lang=en`
- `/preview/whiteboard/projects?lang=en`
- `/preview/whiteboard/projects/australia-40ft-expandable-housing?lang=en`
- `/preview/whiteboard/about?lang=en`

Use `lang=fr` or `lang=ar` for the other languages. The product route also
accepts other existing product slugs, including the cards on the preview home.
The project route also accepts published project slugs from the existing CMS.
Catalogue tabs use existing division/category keys through `collection=…`.

Run the existing web development command from the repository root:

```powershell
npm --workspace @modular/web run dev -- --hostname 127.0.0.1 --port 3110
```

These routes read content through the existing CMS loaders. If the CMS is
unavailable, only this design preview falls back to the existing local product
catalogue and the owner's Australia project snapshot. The fallback photographs
are attributed in `apps/web/public/projects/design-preview/README.md`.
Next's development fetch cache can retain old CMS media URLs; stale generated
cache entries should be cleared when their local media service is unavailable.

The routes are `noindex, nofollow`. Both inquiry forms and Chatbox use their
existing **preview** mode: no inquiry requests, records, or OKKI tracking.
Links marked as the full catalogue/current website go to the existing site
routes, which require the normal CMS service. Email and WhatsApp remain links.

The preview imports no Whiteboard customer images, logos, original forms,
Typeform, analytics or Webflow application runtime. All photographs,
certificates and company video belong to ZHUDUO. The credential wall represents
company certificates; no customer endorsements are invented.

Reference CSS is scoped to `.wbr-preview`. The small `zhuduo-adapter.css`
adapts the wordmark, complete product photographs, shared controls, Arabic
text and demo form to that structure. Original menu, card hover, parallax,
text reveal, video enlargement and credential-wall timelines run locally.
The homepage film follows the reference: muted looping preview, scroll-driven
enlargement and a dark theatre with a sound toggle on the left. Homepage play
and pause overlays are hidden. Reduced motion disables automatic playback and
retains native playback controls. About and project videos still start on a click.
Arabic text reads RTL while the overall layout remains LTR. Reduced motion
keeps content visible without the scroll animations.

No CMS schemas, CMS records, formal routes, inquiry validation or submission
handlers are changed. Existing gallery/player and parameter-parser functions
are exported for reuse without changing their implementation. Local CMS
connectivity is still required to verify live edits; offline preview snapshots
do not prove CMS synchronization.

The imported React template trees bind text and attributes without injecting
CMS HTML. Original source hashes are recorded in `original/provenance.json`.
Normal npm builds use checked-in assets. To regenerate from the reference:

```powershell
python -X utf8 tools/whiteboard-preview/import-template.py
node tools/whiteboard-preview/scope-css.cjs
python -X utf8 tools/whiteboard-preview/import-runtime.py
```

These one-time import tools require BeautifulSoup and the repository's current
PostCSS tools. They make no CMS writes. No push or deployment is included.
