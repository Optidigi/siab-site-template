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
  eyebrow?: string | null
  headline: string
  subheadline?: string | null
  cta?: { label?: string | null; href?: string | null } | null
  image?: MediaRef
}

export type FeatureListBlock = {
  blockType: "featureList"
  title?: string | null
  intro?: string | null
  features: Array<{
    title: string
    description?: string | null
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
  title?: string | null
  items: Array<{ question: string; answer: string }>
}

export type CTABlock = {
  blockType: "cta"
  headline: string
  description?: string | null
  primary?: { label?: string | null; href?: string | null } | null
  secondary?: { label?: string | null; href?: string | null } | null
}

export type RichTextBlock = {
  blockType: "richText"
  body: string
}

export type ContactSectionBlock = {
  blockType: "contactSection"
  title?: string | null
  description?: string | null
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
