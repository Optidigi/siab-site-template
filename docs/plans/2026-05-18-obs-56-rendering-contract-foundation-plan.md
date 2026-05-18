# OBS-56 Rendering Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the RtNode rendering contract + 7 RtRoot-aware structure-only block renderers + role tokens + siteManifest example to `siab-site-template`, so post-CMS-ification (via `siab-payload-orchestrator`'s `site-converter`) the cloned site renders RT v2 jsonb data correctly per the contract.

**Architecture:** Pure additions + 7 component rewrites. Mirror `RtNode` types from siab-payload (separate repo, no shared package). New `RtNodeRenderer.tsx` walks the tree per `rt-dom-contract.md`. New `rich-text.css` ships baseline `rt-*` class styles using theme tokens via `var(...)`. Block renderers consume `RtRoot` for rich-text fields, stamp `id={block.anchor}` on outer `<section>`, use role tokens via inline `style`, ship zero Tailwind decoration. Existing static-mode workflow (siab-site-orchestrator) and preview-iframe (wave-3 PreviewIsland) keep working.

**Tech Stack:** Astro 6 (static mode kept), Preact (cms/* + preview/*), Tailwind v4, TypeScript, Vitest.

**Spec:** `docs/specs/2026-05-18-obs-56-rendering-contract-foundation-design.md`

**Tests in this plan are one-shot validation scaffolding** — written for the implementer to verify renderer correctness during development; **stripped from the template (along with their devDeps) in the final cleanup task** before the branch ships. The template is scaffolding-source-of-truth that gets cloned into per-tenant sites; permanent renderer tests belong in tenant smoke tests / siab-payload's canvas tests / the cms-reviewer subagent, NOT in the template.

**Spec corrections this plan applies inline** (the spec was written before reading siab-payload's exact source — these are the authoritative shapes):
- `RtText.marks` is `RtMark[]` (string array), NOT `{bold?: boolean, ...}` object — per `siab-payload/src/lib/richText/RtNode.ts`
- `RtList` has `items: RtListItem[]`, NOT `children`
- `RtListItem.children: RtBlock[]` (only block-level children)
- `RtLink.children: RtInline[]` (only inline children); `rel` is `"external" | "internal"`, not free-form string
- `RtRoot` is `RtBlockRoot | RtInlineRoot` discriminated by `variant: "block" | "inline"` — block variant has `RtBlock[]` children, inline variant has `RtInline[]` children
- `RtThemed.props` is required, not optional
- `RtHeading` has optional `style` + `align`; `RtParagraph` has optional `align`
- Block field name corrections:
  - **FeatureList** uses `title` / `intro` / `features[]` (each feature has `title` / `description` / `icon`) — NOT `headline` / `subheadline`
  - **CTA** uses `eyebrow` / `headline` / `description` / `primary` / `secondary` — NOT `subheadline`
  - **FAQ** uses `title` / `items[]` (each item has `question: RtRoot` / `answer: RtRoot`) — both rich-text
  - **Testimonials** uses `title?: string` (plain text, OPTIONAL) / `items[]` (each item has `quote: string textarea`, `author: string required`, `role?: string`, `avatar?: upload`)
  - **ContactSection** uses `title: RtRoot` / `description: RtRoot` / `formName: string required` / `fields[]` (each has `name`, `label`, `type: "text"|"email"|"tel"|"textarea"`, `required: boolean`) — NO `submitLabel` field today (OBS-42 not shipped)
  - Image fields are resolved to URL strings by the dispatcher (PreviewIsland today, Blocks.astro after CMS-ification) — renderers receive `imageUrl?: string | null`, NOT `image: {url, alt}`

---

## Prerequisites

```bash
cd /home/shimmy/Desktop/env/siab/siab-site-template
git status   # confirm on feat/obs-56-rendering-contract-foundation branch
pnpm install
pnpm astro check   # baseline typecheck
pnpm test          # baseline tests
```

Confirm baseline is green BEFORE starting. The implementation plan assumes a clean tree.

---

## Task 1: Add RtNode types to `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts` (existing file — append, don't replace)

- [ ] **Step 1: Read the existing `src/lib/types.ts`** to understand what's there + append at the end (don't overwrite).

- [ ] **Step 2: Append the RtNode union**

Append these types to `src/lib/types.ts`:

```ts

// ---------------------------------------------------------------------------
// Rich Text node types
// ---------------------------------------------------------------------------
// MIRRORED FROM siab-payload/src/lib/richText/RtNode.ts
// Keep in sync with that file. If siab-payload's RtNode shape changes,
// update this file in lockstep.

export type RtMark = "bold" | "italic" | "underline" | "code" | "strikethrough"

export interface RtText {
  t: "text"
  v: string
  marks?: RtMark[]
  style?: string
  color?: string
}

export interface RtLink {
  t: "link"
  href: string
  rel?: "external" | "internal"
  children: RtInline[]
}

/** Soft line break — renders as `<br>`; inserted via Shift+Enter. */
export interface RtLineBreak {
  t: "linebreak"
}

export type RtInline = RtText | RtLink | RtLineBreak

export type RtAlign = "left" | "center" | "right" | "justify"

export interface RtParagraph  { t: "paragraph"; align?: RtAlign; children: RtInline[] }
export interface RtHeading    { t: "heading"; level: 2 | 3 | 4; align?: RtAlign; style?: string; children: RtInline[] }
export interface RtList       { t: "list"; ordered: boolean; items: RtListItem[] }
export interface RtListItem   { t: "listItem"; children: RtBlock[] }
export interface RtBlockquote { t: "blockquote"; children: RtBlock[] }
export interface RtDivider    { t: "divider" }

export interface RtThemed {
  t: "themed"
  id: string
  props: Record<string, unknown>
  children?: RtBlock[]
}

export type RtBlock =
  | RtParagraph
  | RtHeading
  | RtList
  | RtBlockquote
  | RtDivider
  | RtThemed

export interface RtBlockRoot  { t: "root"; variant: "block";  children: RtBlock[] }
export interface RtInlineRoot { t: "root"; variant: "inline"; children: RtInline[] }
export type RtRoot = RtBlockRoot | RtInlineRoot

export type RtNode = RtRoot | RtBlock | RtInline | RtListItem
```

- [ ] **Step 3: Typecheck**

```bash
pnpm astro check
```

Expected: clean (no new errors). Types are not yet consumed by any file.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "$(cat <<'EOF'
feat(types): mirror RtNode union from siab-payload

Single-source-of-truth header comment names siab-payload/src/lib/richText/
RtNode.ts as the canonical definition. Needed by RtNodeRenderer (Task 2)
and the 7 block renderers (Tasks 5-11).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `RtNodeRenderer.tsx` + unit tests

**Files:**
- Create: `src/components/cms/RtNodeRenderer.tsx`
- Create: `tests/cms/RtNodeRenderer.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `tests/cms/RtNodeRenderer.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { render } from "@testing-library/preact"
import { RtNodeRenderer } from "../../src/components/cms/RtNodeRenderer"
import type { RtRoot } from "../../src/lib/types"

describe("RtNodeRenderer", () => {
  it("renders a paragraph with text", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{ t: "paragraph", children: [{ t: "text", v: "hello" }] }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    const p = container.querySelector("p.rt-p")
    expect(p).not.toBeNull()
    expect(p?.textContent).toBe("hello")
  })

  it("renders headings with rt-h + rt-h-N classes", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{ t: "heading", level: 2, children: [{ t: "text", v: "Title" }] }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    const h2 = container.querySelector("h2.rt-h.rt-h-2")
    expect(h2).not.toBeNull()
    expect(h2?.textContent).toBe("Title")
  })

  it("renders an ordered list with rt-ol + rt-li", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{
        t: "list", ordered: true,
        items: [
          { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "one" }] }] },
          { t: "listItem", children: [{ t: "paragraph", children: [{ t: "text", v: "two" }] }] },
        ],
      }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("ol.rt-ol")).not.toBeNull()
    expect(container.querySelectorAll("li.rt-li").length).toBe(2)
  })

  it("renders a link with rt-link + href + rel + target", () => {
    const node: RtRoot = {
      t: "root", variant: "inline",
      children: [{
        t: "link", href: "https://example.com", rel: "external",
        children: [{ t: "text", v: "go" }],
      }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    const a = container.querySelector("a.rt-link")
    expect(a).not.toBeNull()
    expect(a?.getAttribute("href")).toBe("https://example.com")
    expect(a?.getAttribute("rel")).toBe("external")
  })

  it("wraps bold + italic text in nested rt-b + rt-i", () => {
    const node: RtRoot = {
      t: "root", variant: "inline",
      children: [{ t: "text", v: "x", marks: ["bold", "italic"] }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    // bold is outer (rendered last in the chain), italic inside
    expect(container.querySelector("strong.rt-b > em.rt-i")).not.toBeNull()
  })

  it("renders style as rt-type-<style> wrapper", () => {
    const node: RtRoot = {
      t: "root", variant: "inline",
      children: [{ t: "text", v: "pull quote", style: "pullquote" }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("span.rt-type-pullquote")).not.toBeNull()
  })

  it("renders color as rt-color-<id> wrapper", () => {
    const node: RtRoot = {
      t: "root", variant: "inline",
      children: [{ t: "text", v: "warn", color: "warning" }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("span.rt-color-warning")).not.toBeNull()
  })

  it("renders themed nodes with rt-themed-<id> + data-rt-id", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{
        t: "themed", id: "eyebrow", props: {},
        children: [{ t: "paragraph", children: [{ t: "text", v: "Eyebrow text" }] }],
      }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    const themed = container.querySelector("div.rt-themed.rt-themed-eyebrow")
    expect(themed).not.toBeNull()
    expect(themed?.getAttribute("data-rt-id")).toBe("eyebrow")
    expect(themed?.textContent).toBe("Eyebrow text")
  })

  it("renders divider as rt-hr", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{ t: "divider" }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("hr.rt-hr")).not.toBeNull()
  })

  it("renders linebreak as <br>", () => {
    const node: RtRoot = {
      t: "root", variant: "inline",
      children: [{ t: "text", v: "a" }, { t: "linebreak" }, { t: "text", v: "b" }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("br")).not.toBeNull()
  })

  it("renders blockquote with rt-quote", () => {
    const node: RtRoot = {
      t: "root", variant: "block",
      children: [{
        t: "blockquote",
        children: [{ t: "paragraph", children: [{ t: "text", v: "wisdom" }] }],
      }],
    }
    const { container } = render(<RtNodeRenderer node={node} />)
    expect(container.querySelector("blockquote.rt-quote")).not.toBeNull()
  })

  it("returns nothing for null/undefined node", () => {
    const { container } = render(<RtNodeRenderer node={null as any} />)
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/cms/RtNodeRenderer.test.tsx
```

Expected: import error — `RtNodeRenderer` doesn't exist yet. If `tests/cms/` doesn't exist as a directory, create it (Vitest discovery picks up `tests/**/*.test.tsx`).

If `@testing-library/preact` isn't installed, add it:

```bash
pnpm add -D @testing-library/preact jsdom @testing-library/dom
```

Then re-run.

- [ ] **Step 3: Create the renderer**

Create `src/components/cms/RtNodeRenderer.tsx`:

```tsx
import type {
  RtNode, RtRoot, RtParagraph, RtHeading, RtList, RtListItem,
  RtBlockquote, RtLink, RtText, RtThemed
} from "../../lib/types"

export function RtNodeRenderer({ node }: { node: RtNode | null | undefined }) {
  if (!node) return null
  switch (node.t) {
    case "root":
      return <>{(node.children as RtNode[] | undefined ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}</>
    case "paragraph":
      return <p class="rt-p" style={node.align ? `text-align:${node.align}` : undefined}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </p>
    case "heading": {
      const Tag = (`h${node.level}` as "h2" | "h3" | "h4")
      const style = node.align ? `text-align:${node.align}` : undefined
      return <Tag class={`rt-h rt-h-${node.level}`} style={style as any}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </Tag>
    }
    case "list": {
      const Tag = node.ordered ? "ol" : "ul"
      const cls = node.ordered ? "rt-ol" : "rt-ul"
      return <Tag class={cls}>
        {(node.items ?? []).map((it, i) => <RtNodeRenderer key={i} node={it} />)}
      </Tag>
    }
    case "listItem":
      return <li class="rt-li">
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </li>
    case "blockquote":
      return <blockquote class="rt-quote">
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </blockquote>
    case "divider":
      return <hr class="rt-hr" />
    case "linebreak":
      return <br />
    case "link":
      return <a class="rt-link" href={node.href} rel={node.rel} target={node.rel === "external" ? "_blank" : undefined}>
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
  // Innermost-first build (so output renders bold > italic when both present)
  if (node.marks?.includes("code"))          out = <code class="rt-code">{out}</code>
  if (node.marks?.includes("strikethrough")) out = <s class="rt-s">{out}</s>
  if (node.marks?.includes("underline"))     out = <u class="rt-u">{out}</u>
  if (node.marks?.includes("italic"))        out = <em class="rt-i">{out}</em>
  if (node.marks?.includes("bold"))          out = <strong class="rt-b">{out}</strong>
  // Style + color wrap OUTSIDE marks
  if (node.color)                            out = <span class={`rt-color-${node.color}`}>{out}</span>
  if (node.style)                            out = <span class={`rt-type-${node.style}`}>{out}</span>
  return <>{out}</>
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/cms/RtNodeRenderer.test.tsx
```

Expected: all 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/cms/RtNodeRenderer.tsx tests/cms/RtNodeRenderer.test.tsx package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(cms): RtNodeRenderer + 12 unit tests covering rt-dom-contract

Preact walker over RtNode tree emitting the rt-* class contract per
siab-payload/docs/runbooks/rt-dom-contract.md. Handles all node types:
root, paragraph, heading, list/listItem, blockquote, divider, linebreak,
link, themed, text (with mark/style/color wrapping order). Tests cover
each node type independently.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `src/styles/rich-text.css`

**Files:**
- Create: `src/styles/rich-text.css`

- [ ] **Step 1: Create the file**

Write `src/styles/rich-text.css`:

```css
/* Baseline rt-* class contract styles. Theme tokens via var() — themes
   override values during siab-site-orchestrator Phase 3 integration. */

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

- [ ] **Step 2: Commit**

```bash
git add src/styles/rich-text.css
git commit -m "$(cat <<'EOF'
feat(styles): baseline rich-text.css with rt-* class contract

Minimal baseline using theme tokens via var(...). Themes layer their
own decoration (rt-type-*, rt-color-*, rt-themed-*) via tenant-theme.css.
Imported from global.css in Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update `src/styles/global.css` with role tokens + import rich-text.css

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Read the current file**

Current state:
```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';

@theme {
  --color-brand: #0ea5e9;
  --color-brand-fg: #ffffff;
  --color-accent: #f59e0b;
  --color-accent-fg: #000000;
}

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 2: Replace with the extended version**

Write the new `src/styles/global.css`:

```css
@import 'tailwindcss';
@import './rich-text.css';
@plugin '@tailwindcss/typography';

@theme {
  /* Existing brand/accent tokens */
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

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-text);
  text-rendering: optimizeLegibility;
}
```

Note: `body`'s `font-family` switched from hardcoded `system-ui, ...` to `var(--font-text)` so the role token actually drives body type.

- [ ] **Step 3: Typecheck + build**

```bash
pnpm astro check
pnpm build
```

Expected: both clean. Tailwind v4 picks up the new `@theme {}` tokens and generates utilities (`font-title`, `rounded-md`, etc.) — adds a small amount to CSS bundle, acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "$(cat <<'EOF'
feat(styles): add role tokens + import rich-text.css

@theme {} gains placeholder --font-{title,heading,text,script,serif,sans}
+ --radius-{sm,md,lg} tokens. body font-family switches from hardcoded
to var(--font-text). Themes override token values during Phase 3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update `Hero.tsx` to RtRoot props + structure-only

**Files:**
- Modify: `src/components/cms/Hero.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/Hero.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import SmoothImage from "./SmoothImage"
import type { RtRoot } from "../../lib/types"

/**
 * Hero block renderer (Preact). Structure-only — no Tailwind decoration.
 * Themes layer all visual styling via tenant-theme.css.
 *
 * Props mirror siab-payload/src/blocks/Hero.ts. Image upload is resolved
 * to a URL by the dispatcher (PreviewIsland today; Blocks.astro after
 * CMS-ification) — renderer receives imageUrl, not an upload ref.
 */
export type HeroProps = {
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  pills?: Array<{ label: string; id?: string | null }>
  cta?: { label?: string | null; href?: string | null } | null
  imageUrl?: string | null
  imageAlt?: string | null
  dataBlockIndex?: number  // PreviewIsland-only; absent in production
}

export default function Hero(props: HeroProps) {
  const { anchor, eyebrow, headline, subheadline, pills, cta, imageUrl, imageAlt, dataBlockIndex } = props
  const ctaLabel = cta?.label?.trim()
  const ctaHref = cta?.href?.trim()
  const showCta = ctaLabel && ctaHref
  return (
    <BlockErrorBoundary blockType="hero">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--hero"
        data-block-index={dataBlockIndex}
      >
        {eyebrow && (
          <div class="cms-block__eyebrow">
            <RtNodeRenderer node={eyebrow} />
          </div>
        )}
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
              <li
                key={p.id ?? i}
                class="cms-block__pill"
                style={{ borderRadius: "var(--radius-sm)" }}
              >
                {p.label}
              </li>
            ))}
          </ul>
        )}
        {showCta && (
          <a
            class="cms-block__cta"
            href={ctaHref}
            style={{ borderRadius: "var(--radius-md)" }}
          >
            {ctaLabel}
          </a>
        )}
        {imageUrl && (
          <figure class="cms-block__image" style={{ borderRadius: "var(--radius-lg)" }}>
            <SmoothImage src={imageUrl} alt={imageAlt ?? ""} />
          </figure>
        )}
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

Expected: may flag a type error at `PreviewIsland.tsx` for the Hero dispatch because Hero's prop type changed. The dispatch passes `eyebrow={block.eyebrow}` etc.; in preview the values are RtRoot (per siab-payload's RT v2 Phase 1), so types line up. If PreviewIsland's `Block` type defines these as `string`, the typecheck will flag at the dispatch site — fix is a separate concern (PreviewIsland's local `Block` type likely needs an update OR the data already comes in as RtRoot and TypeScript loses the trail via `as any` somewhere). Document any new typecheck errors in the commit but don't block on them — PreviewIsland updates can land in a follow-up if scope creeps.

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(cms): Hero renderer — RtRoot props, anchor, structure-only

Replaces string-based fields with RtRoot for eyebrow/headline/subheadline.
Adds optional anchor field stamped as id={anchor || undefined} on outer
<section>. Adopts cms-block__<part> BEM-ish inner classes. Role tokens
applied via inline style at semantic locations: var(--font-title) on h1,
var(--font-text) on subheadline, var(--radius-sm) on pills,
var(--radius-md) on CTA, var(--radius-lg) on image figure. Zero Tailwind
decoration classes — themes own visual styling via tenant-theme.css.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update `FeatureList.tsx` to RtRoot props + structure-only

**Files:**
- Modify: `src/components/cms/FeatureList.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/FeatureList.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import { ICON_MAP } from "./icons"
import type { RtRoot } from "../../lib/types"

/**
 * FeatureList block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/FeatureList.ts.
 */
export type FeatureListProps = {
  anchor?: string | null
  title?: RtRoot | null
  intro?: RtRoot | null
  features: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
  }>
  dataBlockIndex?: number
}

export default function FeatureList(props: FeatureListProps) {
  const { anchor, title, intro, features, dataBlockIndex } = props
  if (!features || features.length === 0) return null
  return (
    <BlockErrorBoundary blockType="featureList">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--featurelist"
        data-block-index={dataBlockIndex}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        {intro && (
          <div class="cms-block__intro" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={intro} />
          </div>
        )}
        <ul class="cms-block__features">
          {features.map((f, i) => {
            const Icon = f.icon ? ICON_MAP[f.icon] : null
            return (
              <li
                key={i}
                class="cms-block__feature"
                style={{ borderRadius: "var(--radius-lg)" }}
              >
                {Icon && <span class="cms-block__feature-icon"><Icon /></span>}
                <h3 class="cms-block__feature-title" style={{ fontFamily: "var(--font-heading)" }}>
                  <RtNodeRenderer node={f.title} />
                </h3>
                {f.description && (
                  <div class="cms-block__feature-description" style={{ fontFamily: "var(--font-text)" }}>
                    <RtNodeRenderer node={f.description} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/FeatureList.tsx
git commit -m "$(cat <<'EOF'
feat(cms): FeatureList renderer — RtRoot props, anchor, structure-only

title/intro and per-feature title/description are RtRoot. Icon resolved
via ICON_MAP from kebab-case string. Adopts cms-block__<part> BEM-ish
inner classes. Role tokens via inline style. Zero Tailwind decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update `Testimonials.tsx` to structure-only (string title preserved)

**Files:**
- Modify: `src/components/cms/Testimonials.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/Testimonials.tsx` with:

```tsx
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import SmoothImage from "./SmoothImage"

/**
 * Testimonials block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/Testimonials.ts.
 * title is plain text (NOT rich text). quote is plain textarea string.
 * avatar resolved to avatarUrl by the dispatcher.
 */
export type TestimonialsProps = {
  anchor?: string | null
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatarUrl?: string | null
  }>
  dataBlockIndex?: number
}

export default function Testimonials(props: TestimonialsProps) {
  const { anchor, title, items, dataBlockIndex } = props
  if (!items || items.length === 0) return null
  return (
    <BlockErrorBoundary blockType="testimonials">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--testimonials"
        data-block-index={dataBlockIndex}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            {title}
          </h2>
        )}
        <ul class="cms-block__testimonials-list">
          {items.map((t, i) => (
            <li
              key={i}
              class="cms-block__testimonial"
              style={{ borderRadius: "var(--radius-lg)" }}
            >
              <blockquote class="cms-block__testimonial-quote" style={{ fontFamily: "var(--font-text)" }}>
                {t.quote}
              </blockquote>
              <figcaption class="cms-block__testimonial-attrib">
                {t.avatarUrl && (
                  <span class="cms-block__testimonial-avatar" style={{ borderRadius: "var(--radius-lg)" }}>
                    <SmoothImage src={t.avatarUrl} alt={t.author} />
                  </span>
                )}
                <span class="cms-block__testimonial-author">{t.author}</span>
                {t.role && <span class="cms-block__testimonial-role">{t.role}</span>}
              </figcaption>
            </li>
          ))}
        </ul>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/Testimonials.tsx
git commit -m "$(cat <<'EOF'
feat(cms): Testimonials renderer — anchor, structure-only

title is plain string (NOT rich text per current schema). quote is
plain textarea string. avatar resolved to avatarUrl by dispatcher.
cms-block__<part> inner classes. Role tokens via inline style. Zero
Tailwind decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update `FAQ.tsx` to RtRoot props + structure-only

**Files:**
- Modify: `src/components/cms/FAQ.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/FAQ.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import type { RtRoot } from "../../lib/types"

/**
 * FAQ block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/FAQ.ts.
 * title is optional RtRoot (inline variant). Each item's question + answer are RtRoot.
 */
export type FAQProps = {
  anchor?: string | null
  title?: RtRoot | null
  items: Array<{
    question: RtRoot
    answer: RtRoot
  }>
  dataBlockIndex?: number
}

export default function FAQ(props: FAQProps) {
  const { anchor, title, items, dataBlockIndex } = props
  if (!items || items.length === 0) return null
  return (
    <BlockErrorBoundary blockType="faq">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--faq"
        data-block-index={dataBlockIndex}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        <dl class="cms-block__faq-list">
          {items.map((item, i) => (
            <details
              key={i}
              class="cms-block__faq-item"
              style={{ borderRadius: "var(--radius-md)" }}
            >
              <summary class="cms-block__faq-question" style={{ fontFamily: "var(--font-heading)" }}>
                <RtNodeRenderer node={item.question} />
              </summary>
              <div class="cms-block__faq-answer" style={{ fontFamily: "var(--font-text)" }}>
                <RtNodeRenderer node={item.answer} />
              </div>
            </details>
          ))}
        </dl>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/FAQ.tsx
git commit -m "$(cat <<'EOF'
feat(cms): FAQ renderer — RtRoot props, anchor, structure-only

title is optional RtRoot (inline). Each item's question + answer are
RtRoot rendered via RtNodeRenderer. Native <details>/<summary> for
accordion behaviour (no JS). cms-block__<part> inner classes. Role
tokens via inline style. Zero Tailwind decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update `CTA.tsx` to RtRoot props + variant dispatch + structure-only

**Files:**
- Modify: `src/components/cms/CTA.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/CTA.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import type { RtRoot } from "../../lib/types"

/**
 * CTA block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/CTA.ts.
 *
 * Variant dispatch on primary.href prefix:
 *   - mailto: / tel: → cms-block--cta-contact
 *   - anything else → cms-block--cta-quote
 * Both share the cms-block--cta base class for shared styling.
 */
export type CTAProps = {
  anchor?: string | null
  eyebrow?: RtRoot | null
  headline: RtRoot
  description?: RtRoot | null
  primary: { label: string; href: string }
  secondary?: { label?: string | null; href?: string | null } | null
  dataBlockIndex?: number
}

function variantFor(href: string): "contact" | "quote" {
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return "contact"
  return "quote"
}

export default function CTA(props: CTAProps) {
  const { anchor, eyebrow, headline, description, primary, secondary, dataBlockIndex } = props
  const variant = variantFor(primary.href)
  const secondaryLabel = secondary?.label?.trim()
  const secondaryHref = secondary?.href?.trim()
  const showSecondary = secondaryLabel && secondaryHref
  return (
    <BlockErrorBoundary blockType="cta">
      <section
        id={anchor || undefined}
        class={`cms-block cms-block--cta cms-block--cta-${variant}`}
        data-block-index={dataBlockIndex}
      >
        {eyebrow && (
          <div class="cms-block__eyebrow" style={{ fontFamily: "var(--font-script)" }}>
            <RtNodeRenderer node={eyebrow} />
          </div>
        )}
        <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
          <RtNodeRenderer node={headline} />
        </h2>
        {description && (
          <div class="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={description} />
          </div>
        )}
        <div class="cms-block__cta-actions">
          <a
            class="cms-block__cta cms-block__cta--primary"
            href={primary.href}
            style={{ borderRadius: "var(--radius-md)" }}
          >
            {primary.label}
          </a>
          {showSecondary && (
            <a
              class="cms-block__cta cms-block__cta--secondary"
              href={secondaryHref}
              style={{ borderRadius: "var(--radius-md)" }}
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/CTA.tsx
git commit -m "$(cat <<'EOF'
feat(cms): CTA renderer — RtRoot props, variant dispatch, structure-only

eyebrow/headline/description are RtRoot. Variant dispatch on primary.href
prefix: mailto:/tel: → cms-block--cta-contact, else cms-block--cta-quote.
Both share cms-block--cta base. Optional secondary button. cms-block__<part>
inner classes. Role tokens via inline style. Zero Tailwind decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update `RichText.tsx` to RtRoot props + structure-only

**Files:**
- Modify: `src/components/cms/RichText.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/RichText.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import type { RtRoot } from "../../lib/types"

/**
 * RichText block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/RichText.ts.
 * body is required RtRoot (block variant).
 */
export type RichTextProps = {
  anchor?: string | null
  body: RtRoot
  dataBlockIndex?: number
}

export default function RichText(props: RichTextProps) {
  const { anchor, body, dataBlockIndex } = props
  if (!body) return null
  return (
    <BlockErrorBoundary blockType="richText">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--richtext"
        data-block-index={dataBlockIndex}
      >
        <div class="cms-block__richtext-body" style={{ fontFamily: "var(--font-text)" }}>
          <RtNodeRenderer node={body} />
        </div>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/RichText.tsx
git commit -m "$(cat <<'EOF'
feat(cms): RichText renderer — RtRoot body, anchor, structure-only

Replaces dangerouslySetInnerHTML + body:string with RtNodeRenderer +
body:RtRoot. cms-block__richtext-body inner class. var(--font-text)
on body wrapper. Zero Tailwind decoration. v2 contract per OBS-47.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Update `ContactSection.tsx` to RtRoot props + form fields + structure-only

**Files:**
- Modify: `src/components/cms/ContactSection.tsx`

- [ ] **Step 1: Replace the file**

Overwrite `src/components/cms/ContactSection.tsx` with:

```tsx
import { RtNodeRenderer } from "./RtNodeRenderer"
import { BlockErrorBoundary } from "./BlockErrorBoundary"
import type { RtRoot } from "../../lib/types"

/**
 * ContactSection block renderer (Preact). Structure-only.
 * Props mirror siab-payload/src/blocks/ContactSection.ts.
 *
 * title + description are RtRoot. formName + fields define the form.
 * No submitLabel field today — hardcoded "Send" pending OBS-42.
 * The form ITSELF (submission, validation, success state) is wired by
 * the tenant's page-level code or a form-handling integration; this
 * renderer just emits the form markup.
 */
export type ContactSectionField = {
  name: string
  label: string
  type: "text" | "email" | "tel" | "textarea"
  required?: boolean
}

export type ContactSectionProps = {
  anchor?: string | null
  title?: RtRoot | null
  description?: RtRoot | null
  formName: string
  fields: ContactSectionField[]
  dataBlockIndex?: number
}

export default function ContactSection(props: ContactSectionProps) {
  const { anchor, title, description, formName, fields, dataBlockIndex } = props
  return (
    <BlockErrorBoundary blockType="contactSection">
      <section
        id={anchor || undefined}
        class="cms-block cms-block--contact"
        data-block-index={dataBlockIndex}
      >
        {title && (
          <h2 class="cms-block__title" style={{ fontFamily: "var(--font-heading)" }}>
            <RtNodeRenderer node={title} />
          </h2>
        )}
        {description && (
          <div class="cms-block__description" style={{ fontFamily: "var(--font-text)" }}>
            <RtNodeRenderer node={description} />
          </div>
        )}
        <form
          class="cms-block__form"
          name={formName}
          method="POST"
          style={{ borderRadius: "var(--radius-md)" }}
        >
          <input type="hidden" name="form-name" value={formName} />
          {fields.map((f) => (
            <div key={f.name} class="cms-block__form-field">
              <label class="cms-block__form-label" htmlFor={`field-${f.name}`}>
                {f.label}{f.required ? " *" : ""}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={`field-${f.name}`}
                  class="cms-block__form-input cms-block__form-input--textarea"
                  name={f.name}
                  required={f.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              ) : (
                <input
                  id={`field-${f.name}`}
                  class="cms-block__form-input"
                  type={f.type}
                  name={f.name}
                  required={f.required ?? false}
                  style={{ borderRadius: "var(--radius-sm)", fontFamily: "var(--font-text)" }}
                />
              )}
            </div>
          ))}
          <button
            type="submit"
            class="cms-block__form-submit"
            style={{ borderRadius: "var(--radius-md)" }}
          >
            Send
          </button>
        </form>
      </section>
    </BlockErrorBoundary>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm astro check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/cms/ContactSection.tsx
git commit -m "$(cat <<'EOF'
feat(cms): ContactSection renderer — RtRoot title/description, form fields, structure-only

title + description are RtRoot. formName + fields[] drive form markup.
Per-field input/textarea dispatch on field.type. Submit button hardcoded
"Send" until OBS-42 lands a CMS-driven submitLabel field. cms-block__form*
inner classes. Role tokens via inline style. Zero Tailwind decoration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Create `siteManifest.example.json` at repo root

**Files:**
- Create: `siteManifest.example.json`

- [ ] **Step 1: Create the file**

Write `siteManifest.example.json` at the repo root (NOT inside src/):

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

- [ ] **Step 2: Commit**

```bash
git add siteManifest.example.json
git commit -m "$(cat <<'EOF'
feat: siteManifest.example.json — minimal generic example for OBS-48

Documents the full RtManifest schema surface (per
siab-payload/src/lib/richText/manifest.ts). Tenant forks customise
blocks[] (subset of slugs in preferred order), add themedNodes /
typeStyles / colorTokens for their custom rich-text vocabulary.
siab-payload-orchestrator's Phase 4 will read this file from the
cloned site and seed it into Tenant.siteManifest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Append README section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read the current README** to find a sensible insertion point (likely after the existing overview, before any "Running locally" / "Development" section).

- [ ] **Step 2: Append the new section**

Append at the END of `README.md`:

```markdown

## Rich-text rendering contract

This template ships the `rt-*` class contract per `siab-payload/docs/runbooks/rt-dom-contract.md`. Block renderers in `src/components/cms/` consume `RtRoot` shapes via `RtNodeRenderer.tsx`. Role tokens (`--font-{title,heading,text}`, `--radius-{sm,md,lg}`) declared in `global.css @theme {}` are placeholders — themes override during siab-site-orchestrator Phase 3 integration.

The post-CMS-ification SSR flow (the `site-converter` subagent in `siab-payload-orchestrator`) wires these renderers to Payload data; in static-mode they remain inert until the CMS-ification phase runs.

Per-tenant block menu subsetting + themed-node declarations + type styles + color tokens live in `siteManifest.example.json` (this template ships a generic example). Tenant forks customise it; `siab-payload-orchestrator` Phase 4 reads it and seeds `Tenant.siteManifest`.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add Rich-text rendering contract section to README

Documents the rt-* class contract, RtNodeRenderer, role tokens,
siteManifest example, and the boundary with site-converter
(siab-payload-orchestrator). Points readers at the canonical
runbook in siab-payload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Verification gates

**Files:** No code changes; verification only.

- [ ] **Step 1: Typecheck**

```bash
pnpm astro check
```

Expected: clean OR only pre-existing errors. If new errors appear at `PreviewIsland.tsx` due to the cms/* prop type changes, the implementer must inspect:
- If `PreviewIsland` has a local `Block` type definition that asserts the old field shapes (strings instead of RtRoot), update those declarations to match the new shapes. Reason: PreviewIsland gets data from siab-payload's preview pipeline, which sends RT v2 jsonb today — the local type was stale.
- If `PreviewIsland` uses `as any` casts that hide the mismatch, this task may pass typecheck. That's not a regression; document any latent issues for follow-up.

If a real type error needs fixing in `PreviewIsland.tsx`, fix it inline in the same task. Commit with `fix(preview): align Block type with RtRoot post-RT-v2`.

- [ ] **Step 2: Unit tests**

```bash
pnpm test
```

Expected: all green. New RtNodeRenderer tests added in Task 2 (12 tests) must pass.

- [ ] **Step 3: Static build**

```bash
pnpm build
```

Expected: clean. Static build still produces `dist/` (no SSR regression because we haven't touched `astro.config.mjs`).

- [ ] **Step 4: Smoke (manual)**

```bash
pnpm dev
```

Open `http://localhost:4321` — confirm the existing index page still renders (markdown-driven static content). The cms/* components shouldn't even be reached in this path; they're only invoked from preview-iframe + (post-CMS-ification) Blocks.astro.

Visit `http://localhost:4321/__preview` — confirm the preview-iframe scaffold renders without console errors. (The preview only meaningfully runs when siab-payload's admin sends a postMessage with block data — without that, it just shows the empty preview shell.)

- [ ] **Step 5: If any verification fails**

Fix inline. Do NOT skip past a real failure. After a fix, commit with `fix(obs-56): <what>` and re-run from Step 1.

- [ ] **Step 6: Commit verification artifacts only if any code changed**

If Steps 1-4 all passed cleanly, no commit needed — Task 14 is complete on a green run.

---

## Task 15: Strip test scaffolding from the template

**Files:**
- Delete: `tests/cms/RtNodeRenderer.test.tsx`
- Delete: `tests/cms/` directory if empty after the test file is removed
- Modify: `package.json` (remove `@testing-library/preact`, `@testing-library/dom`, `jsdom` from devDependencies IF Task 2 added them — if they were already present for other reasons, leave them)

- [ ] **Step 1: Delete the test file**

```bash
rm tests/cms/RtNodeRenderer.test.tsx
rmdir tests/cms 2>/dev/null || true   # remove dir if empty
```

- [ ] **Step 2: Remove test deps from package.json IF Task 2 added them**

Inspect `package.json` for `@testing-library/preact`, `@testing-library/dom`, `jsdom` in devDependencies. Cross-check Task 2's commit (`git show <task-2-sha> -- package.json`) — if Task 2 added these, remove them now. If they were already present at the time of Task 1's verification (`git show e6657c9 -- package.json`), leave them — they served some other purpose pre-OBS-56.

If removing:

```bash
pnpm remove @testing-library/preact @testing-library/dom jsdom
```

Then verify `pnpm-lock.yaml` updated cleanly.

- [ ] **Step 3: Confirm typecheck + build still pass without the test infrastructure**

```bash
pnpm astro check
pnpm build
```

Expected: both clean. Removing tests + their deps doesn't break the runtime — they were dev-only.

- [ ] **Step 4: Commit**

```bash
git add tests/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(template): strip RtNodeRenderer test scaffolding

Tests in Task 2 were one-shot validation during OBS-56 development.
Stripping them + their devDeps now per template-as-scaffold convention:
the template is cloned into per-tenant sites; permanent renderer tests
belong in tenant smoke tests / siab-payload canvas tests / cms-reviewer,
NOT in the template itself.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done — what got built

After all 15 tasks:

1. **`src/lib/types.ts`** — RtNode union mirrored from siab-payload (corrected per actual source, not the spec's earlier guesses)
2. **`src/components/cms/RtNodeRenderer.tsx`** — Preact walker over RtNode tree per rt-dom-contract (tests stripped in Task 15)
3. **`src/styles/rich-text.css`** — baseline `rt-*` class styles using theme tokens
4. **`src/styles/global.css`** — extended with role tokens (`--font-*`, `--radius-*`) + imports rich-text.css
5. **`src/components/cms/*.tsx`** (×7) — all rewritten: RtRoot props for rich-text fields, optional `anchor` prop stamped as `id={anchor || undefined}`, role tokens via inline `style`, structure-only (no Tailwind decoration), wrapped in `BlockErrorBoundary`
6. **`siteManifest.example.json`** at repo root — minimal generic example
7. **`README.md`** — Rich-text rendering contract section
8. **Static-mode workflow preserved** — siab-site-orchestrator flow continues to work unchanged

**Total estimated effort:** 14 tasks, 2-5 min each ≈ 30-70 minutes of focused work + verification time. One PR.

**Downstream specs unlocked:**
1. `siab-payload-orchestrator` `site-converter` updates (SSR conversion machinery — Dockerfile, lib/cms.ts, middleware, BaseLayout tenant-theme injection, scripts/build-cms-css.mjs)
2. `siab-payload-orchestrator` `payload-seeder` updates (read siteManifest.json from site repo into Tenant.siteManifest; generate RtRoot-shaped seeds)
3. `siab-site-orchestrator` documentation updates (theme integration with role tokens; siteManifest example)
4. Per-tenant migrations (ami-care, then amblast, then siteinabox)
