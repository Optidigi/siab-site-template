// src/lib/types.ts — mirror of orchestrator's site-converter scaffold.
// Each tenant's converted site gets its own copy at conversion time;
// this template carries the types so its own type-check (pnpm astro check)
// can resolve imports. Keep in sync with site-converter.md's types codeblock.

export type MediaRef =
  | number
  | string
  | { id: number | string; url?: string | null; filename?: string | null; alt?: string | null }
  | null

export type HeroBlock = {
  blockType: "hero"
  eyebrow?: RtRoot | null
  headline: RtRoot
  subheadline?: RtRoot | null
  cta?: { label?: string | null; href?: string | null } | null
  image?: MediaRef
}

export type FeatureListBlock = {
  blockType: "featureList"
  title?: RtRoot | null
  intro?: RtRoot | null
  features: Array<{
    title: RtRoot
    description?: RtRoot | null
    icon?: string | null
  }>
}

export type TestimonialsBlock = {
  blockType: "testimonials"
  title?: string | null
  items: Array<{
    quote: string
    author: string
    role?: string | null
    avatar?: MediaRef
  }>
}

export type FAQBlock = {
  blockType: "faq"
  title?: RtRoot | null
  items: Array<{ question: RtRoot; answer: RtRoot }>
}

export type CTABlock = {
  blockType: "cta"
  eyebrow?: RtRoot | null
  headline: RtRoot
  description?: RtRoot | null
  primary: { label: string; href: string }
  secondary?: { label?: string | null; href?: string | null } | null
}

export type RichTextBlock = {
  blockType: "richText"
  body: RtRoot
}

export type ContactSectionBlock = {
  blockType: "contactSection"
  title?: RtRoot | null
  description?: RtRoot | null
  formName: string
  fields: Array<{
    name: string
    label: string
    type: "text" | "email" | "tel" | "textarea"
    required?: boolean
  }>
}

export type Block =
  | HeroBlock
  | FeatureListBlock
  | TestimonialsBlock
  | FAQBlock
  | CTABlock
  | RichTextBlock
  | ContactSectionBlock

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
