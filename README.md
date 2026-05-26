# siab-site-template

Astro 5 + Tailwind 4 boilerplate consumed by `optidigi/siab-site-orchestrator`.
Per-engagement, the orchestrator copies this template into `sandbox/site-<slug>/`,
integrates a theme from `siab-site-themes/`, fills content via subagents, and pushes.

## What's in the box

- **Astro 5.x**, `output: static`, with `@astrojs/sitemap` + `astro-seo`
- **Tailwind 4** via `@tailwindcss/vite` + `@tailwindcss/typography`
- **SEO baseline**: per-page `<title>`/meta/OG/Twitter, sitemap, dynamic `robots.txt`,
  `llms.txt`, `humans.txt`, `/.well-known/security.txt`, JSON-LD `Organization`
  (always) + `LocalBusiness` (if NAP supplied), favicon set, manifest
- **ContactForm** component: mailto fallback by default; renders Web3Forms
  POST form when `PUBLIC_WEB3FORMS_KEY` is set
- **Dockerfile**: multi-stage `node:lts-alpine` → `nginx:alpine`, ~30MB final image
- **nginx.conf**: gzip, asset/HTML cache strategy, security headers (CSP, X-Frame-Options, etc.)
- **GHA `publish.yml`**: push to `main` → `ghcr.io/<owner>/<repo>:latest` + `:sha-<short>`

## Local development

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # static output to dist/
pnpm astro check  # type / schema check
```

## Environment variables

See `.env.example`. `SITE_URL` is the only one the build needs;
`PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL`, and
`PUBLIC_TURNSTILE_SITE_KEY` are optional.

## Don't edit this template directly during a site engagement

The orchestrator copies the template into `sandbox/site-<slug>/` and works there.
Edits to this template apply to *all future* sites. Land them in a PR and pull
into `siab-site-template/` on disk before starting the next engagement.

## Rich-text rendering contract

This template ships the `rt-*` class contract per `siab-payload/docs/runbooks/rt-dom-contract.md`. Block renderers in `src/components/cms/` consume `RtRoot` shapes via `RtNodeRenderer.tsx`. Role tokens (`--font-{title,heading,text}`, `--radius-{sm,md,lg}`) declared in `global.css @theme {}` are placeholders — themes override during siab-site-orchestrator Phase 3 integration.

The post-CMS-ification SSR flow (the `site-converter` subagent in `siab-payload-orchestrator`) wires these renderers to Payload data; in static-mode they remain inert until the CMS-ification phase runs.

Per-tenant block menu subsetting + themed-node declarations + type styles + color tokens live in `siteManifest.example.json` (this template ships a generic example). Tenant forks customise it; `siab-payload-orchestrator` Phase 4 reads it and seeds `Tenant.siteManifest`.

## `siteManifest.blocks[]` — the per-tenant CMS block menu

`siteManifest.blocks[]` is the source of truth for **which block types the CMS shows in the "Add block" menu for this tenant**. The CMS reads it at edit time (`BlockPresetsContext`) and enforces it at save time (`enforceTenantBlockMenu` hook in siab-payload).

### Behaviour

- **Field present and non-empty**: the CMS shows only the listed block types. Saves that introduce blocks outside the declared set are rejected with `Page contains block types not in this tenant's manifest`.
- **Field absent (or `blocks` not set)**: the CMS falls back to **all 7 block types visible** — backwards-compatible default for tenants that haven't declared a menu.

### Valid slugs

These are the 7 canonical block slugs registered in `siab-payload/src/blocks/`. Use these verbatim in `blocks[]` — unknown slugs are dropped with a console warning (`[resolveAllowedBlocks] manifest declares unknown block slug: <slug>; skipping`):

| Slug | Block |
|---|---|
| `hero` | Hero — headline, subheadline, image, pills, CTA |
| `featureList` | Feature list (camelCase) — grid of feature cards |
| `testimonials` | Testimonials carousel/grid |
| `faq` | FAQ — accordion |
| `cta` | Standalone CTA block |
| `richText` | Rich-text block (camelCase) — long-form body content |
| `contactSection` | Contact form section (camelCase) |

### Item shape

Each entry is an object:

```json
{ "slug": "hero", "label": "Hero", "defaultAnchor": "top" }
```

- `slug` — required; one of the 7 above
- `label` — optional; UI label override (defaults to the block's registered label)
- `defaultAnchor` — optional; pre-fills the `anchor` field when a new instance is inserted via the canvas (per OBS-58 — feature dormant until the registry-side `useCanvasBlocks(manifest)` passthrough lands)

Duplicates rejected at schema time.

### Authoring guidance

Start from `siteManifest.example.json` (this template's all-7-blocks default). Subset for tenants that only use a slice of the menu — most one-page brochure sites need only `hero` + `featureList` + `richText` + `cta`. Removing FAQ/testimonials/contactSection from `blocks[]` removes them from the admin's "Add block" menu entirely, which keeps the authoring surface focused.

### Integration touchpoints

- **`siab-payload-orchestrator/.claude/agents/payload-seeder.md` § "Seed Tenant.siteManifest"** — Phase 4 reads `${SITE_REPO}/siteManifest.json` (or falls back to `siteManifest.example.json`) and PATCHes it onto `Tenant.siteManifest`.
- **`siab-site-orchestrator/.claude/agents/reviewer.md` § Phase 7 gate** — requires `siteManifest.json` at the site repo root before sign-off.
- **`siab-payload/src/lib/richText/manifest.ts`** — Zod schema; canonical validation source.
- **`siab-payload/src/hooks/enforceTenantBlockMenu.ts`** — save-time gate.
- **`siab-payload/src/components/editor/BlockPresetsContext.tsx`** — UI-side filter for the "Add block" menu.
