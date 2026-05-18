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
