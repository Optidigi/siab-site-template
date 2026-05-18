# OBS-56 — siab-site-template: rendering contract foundation for the post-Phase-D consumer

**Status:** Draft for review
**Date:** 2026-05-18
**Backlog:** `siab-payload/docs/backlog/infra/README.md` — OBS-56 (sister-repo sync) · `siab-payload/docs/backlog/features/README.md` — OBS-47 (rich-text v2 backport) · OBS-48 (`siteManifest.example.json`)
**Depends on:** `siab-payload` Phase D + OBS-57 (closed at `c699678` on `siab-payload@main`)
**Blocks:** `siab-payload-orchestrator` `site-converter` updates · `siab-site-orchestrator` documentation updates · per-tenant migrations (amicare, amblast, siteinabox)

---

## 1. Context

The template is the **Astro static boilerplate** that `siab-site-orchestrator` clones to spin up a new client landing page (`prompt.md` Phase 2: `cp -r siab-site-template/. site-<slug>/`). The static site lives at `optidigi/site-<slug>` and is served by nginx via the published image.

**CMS-ification happens later, via a different orchestrator.** When the operator runs `/add-cms <slug>` against an existing static site, `siab-payload-orchestrator` Phase 5 dispatches the `site-converter` subagent. That subagent performs a **surgical SSR conversion** — flips `output:'static'`→`'server'`, replaces the nginx Dockerfile with a Node-runtime one, adds `src/lib/cms.ts` to read from `CMS_DATA_DIR`, adds `src/middleware.ts` with security headers, adds `/healthz`, rewires page routes to read from Payload data, and deletes markdown content (source of truth becomes Payload).

So the template has two consumers in sequence:
1. `siab-site-orchestrator` — static-mode (markdown content, nginx)
2. `siab-payload-orchestrator` (via `site-converter`) — CMS-mode (Payload content, SSR + Node)

The template stays **static-first**. It must continue to work for new client spin-ups via siab-site-orchestrator. The new shape merely adds the **rendering primitives** the post-conversion site needs — so the `site-converter` subagent has a coherent set of building blocks to wire up at CMS-ification time instead of inventing them per-tenant.

### What changed upstream that motivates this work

`siab-payload` Phase D + OBS-57 landed a contract:
- **Rich Text v2** — block rich-text fields are `RtRoot` jsonb (not HTML strings). Class names per `siab-payload/docs/runbooks/rt-dom-contract.md` (`rt-p`, `rt-h rt-h-N`, `rt-link`, `rt-themed rt-themed-Z`, etc.).
- **Per-tenant `siteManifest`** — declares allowed `blocks[]`, `themedNodes[]`, `typeStyles[]`, `colorTokens[]`, `cssEntry`. Lives in `Tenant.siteManifest` jsonb column.
- **Per-block `anchor`** — every page block has an optional anchor that renders as `<section id={anchor}>`.
- **Role tokens** — `--font-{title,heading,text}`, `--radius-{sm,md,lg}` (consumed via `var(...)` chains).
- **Themed-matcher registry** — `themedNodes[].id` declarations resolve to per-category matchers; matchers live server-side in `siab-payload/src/lib/richText/themedMatchers/`.

The template needs to emit DOM that conforms to that contract, so post-conversion the site renders pages correctly without per-tenant inventiveness.

## 2. Goals

1. **Ship the `rt-*` rendering primitives.** Add `RtNodeRenderer.tsx` (Preact walker over RtNode tree) + `src/styles/rich-text.css` (baseline classes) so post-CMS-ification, rich-text fields render per the contract.
2. **Update the 7 `src/components/cms/*.tsx` to consume RtRoot.** Replace string-based `body`/`headline`/etc. with `RtRoot`. Add optional `anchor` prop, stamp `id={anchor || undefined}` on outer `<section>`. Consume role tokens via inline `style={{ fontFamily: "var(--font-*)" }}` and equivalent. Stay structure-only (no decoration classes — themes own decoration).
3. **Add role tokens to `src/styles/global.css @theme {}`.** Placeholder values; themes override during siab-site-orchestrator Phase 3.
4. **Ship `siteManifest.example.json` at repo root.** Minimal generic shape — `siab-payload-orchestrator` will copy + customise it during Phase 4.
5. **Mirror RtNode types in `src/lib/types.ts`.** Single contract source per `siab-payload/src/lib/richText/RtNode.ts`.
6. **Preserve the existing static-mode workflow.** `siab-site-orchestrator` continues to work without modification — markdown rendering, Content Collections, nginx Dockerfile, `astro.config.mjs` static output all unchanged.

## 3. Non-goals (these belong in other specs)

- **SSR conversion** — flipping `output:'server'`, adding `@astrojs/node`, replacing the nginx Dockerfile, adding `docker-entrypoint.sh`. Lives in `siab-payload-orchestrator`'s `site-converter` subagent spec.
- **`src/lib/cms.ts`** (CMS_DATA_DIR reader) — created by `site-converter` during CMS-ification.
- **`src/middleware.ts`** + `/healthz` — created by `site-converter`.
- **`BaseLayout.astro` tenant-theme.css injection** from CMS_DATA_DIR — done by `site-converter`.
- **`scripts/build-cms-css.mjs`** + watcher — only relevant post-conversion when the tenant ships compiled CSS for siab-payload's canvas (OBS-55 territory; lives in `site-converter` or a future per-tenant build step).
- **Per-tenant `blocks[]` enforcement in template renderer** — `siab-payload`'s `enforceTenantBlockMenu` hook gates this server-side. Template renders whatever the page document contains.
- **Themed-node matcher implementations** — those live in `siab-payload/src/lib/richText/themedMatchers/<category>/`. Template just renders the resulting DOM per the contract (`<div class="rt-themed rt-themed-<id>" data-rt-id="<id>">`).
- **Theme integration changes** — themes (`siab-site-themes`) keep their existing integration contract with the template; this spec doesn't alter the Phase 3 flow.

## 4. Architecture

### 4.1 `src/components/cms/RtNodeRenderer.tsx` (NEW)

Preact recursive component walking RtNode tree per `siab-payload/docs/runbooks/rt-dom-contract.md`. Single source of truth for rt-class emission.

```tsx
import type { RtNode, RtRoot, RtParagraph, RtHeading, RtList, RtListItem,
              RtQuote, RtLink, RtText, RtThemed } from "../../lib/types"

export function RtNodeRenderer({ node }: { node: RtNode }) {
  if (!node) return null
  switch (node.t) {
    case "root":
      return <>{(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}</>
    case "paragraph":
      return <p class="rt-p">{(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}</p>
    case "heading": {
      const Tag = (`h${node.level}` as "h2" | "h3" | "h4")
      return <Tag class={`rt-h rt-h-${node.level}`}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </Tag>
    }
    case "list": {
      const Tag = node.ordered ? "ol" : "ul"
      const cls = node.ordered ? "rt-ol" : "rt-ul"
      return <Tag class={cls}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </Tag>
    }
    case "listItem":
      return <li class="rt-li">{(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}</li>
    case "blockquote":
      return <blockquote class="rt-quote">
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </blockquote>
    case "divider":
      return <hr class="rt-hr" />
    case "linebreak":
      return <br />
    case "link":
      return <a class="rt-link" href={node.href} rel={node.rel} target={node.target}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </a>
    case "themed":
      return <div class={`rt-themed rt-themed-${node.id}`} data-rt-id={node.id}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </div>
    case "text":
      return <RtTextNode node={node} />
  }
}

function RtTextNode({ node }: { node: RtText }) {
  const text = node.v ?? ""
  let out: any = text
  // marks innermost → out
  if (node.marks?.code)          out = <code class="rt-code">{out}</code>
  if (node.marks?.strikethrough) out = <s class="rt-s">{out}</s>
  if (node.marks?.underline)     out = <u class="rt-u">{out}</u>
  if (node.marks?.italic)        out = <em class="rt-i">{out}</em>
  if (node.marks?.bold)          out = <strong class="rt-b">{out}</strong>
  // style + color wrap outside marks
  if (node.color)                out = <span class={`rt-color-${node.color}`}>{out}</span>
  if (node.style)                out = <span class={`rt-type-${node.style}`}>{out}</span>
  return <>{out}</>
}
```

**Notes:**
- All node types covered per `rt-dom-contract.md`. If a node type is missing from the union (e.g. future addition), TypeScript exhaustiveness check in the `switch` flags it at compile time.
- Themed nodes render their `children` recursively. Their inner structure (e.g. an `eyebrow` themed-node wrapping plain text) comes from the children tree, not from per-themed-node logic. If a tenant wants special themed-node DOM, they style `rt-themed-<id>::before/::after` via their tenant CSS — no template change needed.
- Text-mark wrapping order matters: `style` (outermost), `color`, `bold`, `italic`, `underline`, `strikethrough`, `code` (innermost). Matches the contract.

### 4.2 `src/styles/rich-text.css` (NEW)

Baseline `rt-*` class contract styles using theme tokens via `var(--*)`. Structure-only.

```css
/* Block-level rt-* nodes */
.rt-p          { margin: 0 0 1em; }
.rt-h          { font-family: var(--font-heading, inherit); }
.rt-h-2        { font-size: 1.5rem; }
.rt-h-3        { font-size: 1.25rem; }
.rt-h-4        { font-size: 1rem; }
.rt-ul,
.rt-ol         { padding-left: 1.5em; margin: 0 0 1em; }
.rt-li         { margin: 0 0 0.25em; }
.rt-quote      { border-left: 3px solid currentColor; padding-left: 1em; font-style: italic; opacity: 0.85; }
.rt-hr         { border: 0; border-top: 1px solid currentColor; opacity: 0.2; margin: 1.5em 0; }

/* Inline rt-* nodes */
.rt-link       { text-decoration: underline; }
.rt-b          { font-weight: bold; }
.rt-i          { font-style: italic; }
.rt-u          { text-decoration: underline; }
.rt-s          { text-decoration: line-through; }
.rt-code       { font-family: ui-monospace, monospace; padding: 0 0.25em; border-radius: var(--radius-sm, 0.125rem); background: rgb(0 0 0 / 0.05); }

/* rt-type-<style> / rt-color-<id> / rt-themed-<id> are tenant-owned. */
/* Themes layer their own decoration via tenant-theme.css. */
```

Imported from `global.css` via `@import './rich-text.css'`.

### 4.3 `src/styles/global.css` — role-token additions

Add to the existing `@theme {}` block:

```css
@theme {
  /* Existing brand/accent tokens kept as-is */
  --color-brand: #0ea5e9;
  --color-brand-fg: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-fg: #000000;

  /* Role tokens (NEW) — placeholder fallbacks; themes override during Phase 3 integration */
  --font-title:   ui-serif, Georgia, serif;
  --font-heading: ui-serif, Georgia, serif;
  --font-text:    ui-sans-serif, system-ui, sans-serif;
  --font-script:  ui-cursive, cursive;
  --font-serif:   ui-serif, Georgia, serif;
  --font-sans:    ui-sans-serif, system-ui, sans-serif;

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
}

/* Existing html/body resets kept as-is */
```

Add `@import './rich-text.css';` line near the top of `global.css` (after `@import 'tailwindcss';` + `@plugin '@tailwindcss/typography';`).

**Note on theme overrides:** When siab-site-orchestrator Phase 3 integrates a theme, the theme's `@theme {}` overrides supersede these placeholder values. Pattern unchanged from today — the spec just adds more tokens to the placeholder set.

### 4.4 Block renderer updates (`src/components/cms/*.tsx` × 7)

All 7 components migrate from string-based to RtRoot-based field shapes. Common pattern:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import type { RtRoot } from "../../lib/types"
import { BlockErrorBoundary } from "./BlockErrorBoundary"

export type HeroProps = {
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  pills?: { label: string; id?: string | null }[]
  cta?: { label?: string | null; href?: string | null } | null
  image?: { url?: string; alt?: string } | null
  imageAlt?: string | null
  dataBlockIndex?: number  // preview-iframe only
}

export default function Hero(props: HeroProps) {
  const { anchor, eyebrow, headline, subheadline, pills, cta, image, imageAlt, dataBlockIndex } = props
  return (
    <BlockErrorBoundary blockType="hero">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--hero"
        data-block-index={dataBlockIndex}
      >
        {eyebrow && <div class="cms-block__eyebrow"><RtNodeRenderer node={eyebrow} /></div>}
        <h1 class="cms-block__title" style={{ fontFamily: "var(--font-title)" }}>
          <RtNodeRenderer node={headline} />
        </h1>
        {subheadline && (
          <div class="cms-block__subheadline" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={subheadline} />
          </div>
        )}
        {pills && pills.length > 0 && (
          <ul class="cms-block__pills">
            {pills.map((p, i) => (
              <li key={p.id ?? i} class="cms-block__pill" style={{ borderRadius: "var(--radius-sm)" }}>
                {p.label}
              </li>
            ))}
          </ul>
        )}
        {cta?.href && (
          <a class="cms-block__cta" href={cta.href} style={{ borderRadius: "var(--radius-md)" }}>
            {cta.label ?? ""}
          </a>
        )}
        {image?.url && (
          <figure class="cms-block__image" style={{ borderRadius: "var(--radius-lg)" }}>
            <img src={image.url} alt={imageAlt ?? image.alt ?? ""} />
          </figure>
        )}
      </section>
    </BlockErrorBoundary>
  )
}
```

**Rules followed in every renderer:**
1. Outer `<section>` always carries `id={anchor || undefined}`, `class="cms-block cms-block--<slug>"`, and `data-block-index={dataBlockIndex}` (preview only).
2. Semantic inner classes use `cms-block__<part>` (e.g. `cms-block__eyebrow`, `cms-block__title`, `cms-block__pills`). Tenant CSS targets these.
3. Role tokens applied inline at semantic locations: `var(--font-title)` on H1, `var(--font-heading)` on H2/H3, `var(--font-text)` on body, `var(--radius-md)` on buttons, `var(--radius-lg)` on cards/images, `var(--radius-sm)` on chips.
4. **No Tailwind utility classes at all** — no `bg-*`, `text-*`, `rounded-*`, `flex`, `mx-auto`, padding, margin, or any other Tailwind utility. Themes own layout AND decoration. Template emits semantic HTML in default browser flow (block-flow `<section>`, `<div>`, `<ul>`, `<li>`, etc.); themes layer flex/grid/spacing on top.
5. No hardcoded literal anchor fallbacks. If a tenant wants legacy anchors (`werkwijze` etc.), they seed `block.anchor` in their data.
6. `BlockErrorBoundary` wraps every block (already in template; preserved).

**Per-block field map** (from `siab-payload/src/blocks/*.ts`):

| Block | Required fields | Optional fields | Special structure |
|---|---|---|---|
| `Hero` (slug `hero`) | `headline: RtRoot` | `anchor`, `eyebrow: RtRoot`, `subheadline: RtRoot`, `pills[]`, `cta{label,href}`, `image`, `imageAlt` | `<h1>` + image figure |
| `FeatureList` (slug `featureList`) | `headline: RtRoot` | `anchor`, `subheadline: RtRoot`, `features[]{title,description,icon}` | `<h2>` + `<ul>` feature list |
| `CTA` (slug `cta`) | `headline: RtRoot`, `primary{label,href}` | `anchor`, `eyebrow: RtRoot`, `subheadline: RtRoot`, `secondary{label,href}` | Variant dispatch on `primary.href` prefix: `mailto:`/`tel:` → `cms-block--cta-contact`, else → `cms-block--cta-quote`. Both share `cms-block--cta` base. |
| `FAQ` (slug `faq`) | `headline: RtRoot`, `items[]{question,answer}` | `anchor`, `subheadline: RtRoot` | `<dl>` + `<details>` per item |
| `RichText` (slug `richText`) | `body: RtRoot` | `anchor` | Single `<RtNodeRenderer>` |
| `Testimonials` (slug `testimonials`) | `title: string`, `items[]{quote,author,role?,avatar?}` | `anchor`, `subheadline: RtRoot` | Card grid (`<ul>`/`<li>`). `title` is plain string per current schema. |
| `ContactSection` (slug `contactSection`) | `headline: RtRoot` | `anchor`, `subheadline: RtRoot`, `submitLabel` (defaults to "Send" per OBS-42 — when that lands the field becomes CMS-driven; until then, hardcoded fallback) | Form-preview wrapper |

The exact field shape follows `siab-payload/src/blocks/<Name>.ts`. If siab-payload adds/removes a field, this template's renderer needs to match — the contract is one-way: siab-payload's schema is the source of truth.

### 4.5 `src/lib/types.ts` (RtNode mirror)

Mirror the RtNode discriminated union from `siab-payload/src/lib/richText/RtNode.ts`. Re-declared here (separate repo, no shared package today) with a header comment naming the canonical source.

```ts
// Mirrored from siab-payload/src/lib/richText/RtNode.ts
// Keep in sync with that file. If siab-payload's RtNode shape changes,
// update this file in lockstep.

export type RtRoot = { t: "root"; variant: "inline" | "block"; children?: RtNode[] }
export type RtParagraph = { t: "paragraph"; children?: RtNode[] }
export type RtHeading = { t: "heading"; level: 2 | 3 | 4; children?: RtNode[] }
export type RtList = { t: "list"; ordered?: boolean; children?: RtListItem[] }
export type RtListItem = { t: "listItem"; children?: RtNode[] }
export type RtQuote = { t: "blockquote"; children?: RtNode[] }
export type RtDivider = { t: "divider" }
export type RtLineBreak = { t: "linebreak" }
export type RtLink = { t: "link"; href: string; rel?: string; target?: string; children?: RtNode[] }
export type RtText = {
  t: "text"
  v?: string
  marks?: { bold?: boolean; italic?: boolean; underline?: boolean; code?: boolean; strikethrough?: boolean }
  style?: string   // resolves to rt-type-<style>
  color?: string   // resolves to rt-color-<color>
}
export type RtThemed = { t: "themed"; id: string; props?: Record<string, unknown>; children?: RtNode[] }

export type RtNode = RtRoot | RtParagraph | RtHeading | RtList | RtListItem
                   | RtQuote | RtDivider | RtLineBreak | RtLink | RtText | RtThemed
```

### 4.6 `siteManifest.example.json` at repo root (NEW)

Minimal generic shape, ready for `siab-payload-orchestrator` to copy + customise during Phase 4.

```json
{
  "version": 1,
  "inlineMarks": {
    "bold": true,
    "italic": true,
    "underline": true,
    "code": true,
    "strikethrough": false
  },
  "blockTypes": {
    "paragraph": true,
    "heading": { "levels": [2, 3] },
    "bulletList": true,
    "orderedList": true,
    "blockquote": true,
    "divider": true
  },
  "blocks": [
    { "slug": "hero" },
    { "slug": "featureList" },
    { "slug": "richText" },
    { "slug": "cta" },
    { "slug": "contactSection" },
    { "slug": "faq" },
    { "slug": "testimonials" }
  ],
  "typeStyles": [],
  "colorTokens": [],
  "themedNodes": [],
  "cssEntry": "cms-editor.css",
  "defaultMode": "canvas"
}
```

Per-field commentary lives in `siab-payload`'s `src/lib/richText/manifest.ts` (the zod schema is the canonical doc).

### 4.7 README addition (small)

Append a short section to `README.md`:

> ## Rich-text rendering contract
>
> This template ships the `rt-*` class contract per `siab-payload/docs/runbooks/rt-dom-contract.md`. Block renderers in `src/components/cms/` consume `RtRoot` shapes via `RtNodeRenderer.tsx`. Role tokens (`--font-{title,heading,text}`, `--radius-{sm,md,lg}`) declared in `global.css @theme {}` are placeholders — themes override during siab-site-orchestrator Phase 3 integration. The post-CMS-ification SSR flow (the `site-converter` subagent in `siab-payload-orchestrator`) wires these renderers to Payload data; in static-mode they remain inert until the CMS-ification phase runs.

## 5. Backwards compatibility

The template's existing static-mode workflow continues to work without changes:

| Surface | Static mode (siab-site-orchestrator) | After this spec | After CMS-ification (site-converter) |
|---|---|---|---|
| `astro.config.mjs` `output:'static'` | yes | yes | flipped to `'server'` by converter |
| Markdown content via Content Collections | yes | yes (unchanged) | deleted by converter |
| `cms/*` components actively rendered | no (only via preview-iframe) | no (same) | yes (post-conversion page routes) |
| Nginx Dockerfile | yes | yes | replaced by converter |
| Tailwind v4 build dep | yes | yes | yes |
| `@theme {}` role tokens | absent | present (placeholder) | tenant overrides via Phase 3 + tenant-theme.css |

The static-site flow that siab-site-orchestrator drives is unaffected. The new files (`RtNodeRenderer.tsx`, `rich-text.css`, `siteManifest.example.json`, `lib/types.ts`) are additive. The block renderer updates change prop types from `string` to `RtRoot`, but since cms/* components are not invoked during the static-mode page render (markdown pages use Astro's `<Content />`), there's no breakage in the static-mode runtime.

The **wave-3 preview-iframe** path that uses `PreactBlocks` to dispatch into cms/* components MAY break if Payload feeds it old-shape data. In practice, preview is only activated during siab-payload-driven editing — and siab-payload@main is rt-v2 today, so it feeds RtRoot already. No regression expected.

## 6. Risks

- **Tailwind v4 + role-token build interaction.** Adding `--font-*` / `--radius-*` tokens to `@theme {}` causes Tailwind to generate utility classes (`font-title`, `rounded-md`, etc.). Bundle size grows marginally. Acceptable; tenants opt out at theme integration if needed.
- **`tailwind.config.ts` autocomplete drift.** The config file's `extend.colors` mirrors `@theme {}` for editor tooling. Spec adds tokens to `@theme {}` only — `tailwind.config.ts` doesn't gain matching entries (it's `colors`-specific). If autocomplete on `font-title` / `rounded-md` is desired, follow up with a `tailwind.config.ts` extension. Not blocking.
- **Preview-iframe regression.** The wave-3 preview infrastructure dispatches to cms/* via `PreactBlocks`. Updating the component prop types may surface latent type mismatches in `PreactBlocks`. Mitigation: `PreactBlocks` already accepts `unknown`-shaped block data; typecheck after the cms/* updates and fix any drift.
- **Themes that injected their own `@theme {}` overrides** could conflict with the role-token defaults this spec adds. CSS `@theme {}` is order-dependent — later declarations win. Since themes are layered AFTER the template's `global.css` (per Phase 3), tenant tokens override placeholders. No conflict in practice.
- **`siteManifest.example.json` slug-casing.** Must use the camelCase slugs (`featureList`, `richText`, `contactSection`) per siab-payload's actual registry. Lowercase versions would be silently skipped by `resolveAllowedBlocks` post-seed.

## 7. Open questions

1. **Should `rich-text.css` be more opinionated** about typography (line-height, font-size scale, etc.) — or stay this minimal? Recommend **stay minimal**. Themes do typography.
2. **`tailwind.config.ts` editor-autocomplete sync** — extend with `fontFamily` + `borderRadius` entries mirroring the new `@theme {}` tokens? Recommend **defer** to a follow-up if/when an operator complains about missing autocomplete. Not load-bearing.
3. **`src/lib/types.ts` location** — alongside the existing types in that file, or a new `src/lib/rt-types.ts`? Recommend **same file**, with a clear section comment. Single source of truth per repo.
4. **README placement** — append a "Rich-text rendering contract" section, or create a `docs/RENDERING-CONTRACT.md`? Recommend **append to README**, since README is what siab-site-orchestrator + new contributors read first.

## 8. Sequencing — what this unblocks

Once this spec lands:
1. **`siab-payload-orchestrator` `site-converter` spec** — covers the heavy SSR conversion (Dockerfile, `lib/cms.ts`, `middleware.ts`, `BaseLayout` tenant-theme.css injection, `astro.config.mjs` flip, healthz route). The converter consumes the rendering primitives this spec ships.
2. **`siab-payload-orchestrator` `payload-seeder` spec** — copies `siteManifest.example.json` from the cloned site to `Tenant.siteManifest`. Switches seed generator from HTML strings to RtRoot shapes.
3. **`siab-site-orchestrator` updates** (small) — documents how themes interact with the new role tokens; documents `siteManifest.example.json` as a tenant input.
4. **Per-tenant migrations** (ami-care first, then amblast + siteinabox) — adopt `siteManifest.json` at site repo root, switch from hardcoded section IDs to `block.anchor`.

Each subsequent spec gets its own brainstorm + plan + implementation.

## 9. Acceptance criteria

- [ ] `src/components/cms/RtNodeRenderer.tsx` exists; covers all RtNode variants per `rt-dom-contract.md`
- [ ] `src/styles/rich-text.css` exists with baseline `rt-*` class styles; imported from `global.css`
- [ ] `src/styles/global.css @theme {}` has role tokens (`--font-*`, `--radius-*`) as placeholders
- [ ] All 7 `src/components/cms/*.tsx` consume `RtRoot` for rich-text fields, accept optional `anchor` prop, stamp `id={anchor || undefined}` on outer `<section>`, use role tokens via inline `style` at semantic locations, ship zero Tailwind decoration classes
- [ ] `src/lib/types.ts` exports the RtNode union mirrored from siab-payload
- [ ] `siteManifest.example.json` exists at repo root with the spec's exact shape (camelCase slugs)
- [ ] `README.md` has a "Rich-text rendering contract" section
- [ ] `pnpm astro check` clean
- [ ] `pnpm test` clean (existing vitest suite + any added unit tests for RtNodeRenderer against rt-fixtures)
- [ ] `pnpm build` clean (static-mode build still succeeds — no SSR regression)
- [ ] siab-site-orchestrator's full flow (Phase 1-10) can spin up a new static site without errors (smoke check: clone template, apply a theme, build, no failures)
