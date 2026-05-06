import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks"
import type { Block, MediaRef } from "../../lib/types"
import Hero from "../cms/Hero"
import RichText from "../cms/RichText"
import CTA from "../cms/CTA"
import FeatureList from "../cms/FeatureList"
import Testimonials from "../cms/Testimonials"
import FAQ from "../cms/FAQ"
import ContactSection from "../cms/ContactSection"
import { BlockErrorBoundary } from "../cms/BlockErrorBoundary"

type DraftMessage = {
  type: "preview:draft"
  version: 1
  payload: { page: { blocks: Block[] } }
}

type Props = {
  allowedOrigin: string
  cmsOrigin: string
}

/**
 * Preview island. Server-rendered as null; on mount (client:load) registers
 * postMessage listener. On `preview:draft` from the admin origin, swaps in
 * the rendered block tree.
 *
 * Sends:
 *  - preview:ready  once after first hydration
 *  - preview:heartbeat  every 30s after ready
 *  - preview:error  on render exceptions (caught by BlockErrorBoundary)
 */
export default function PreviewIsland({ allowedOrigin, cmsOrigin }: Props) {
  const [draft, setDraft] = useState<{ blocks: Block[] } | null>(null)
  const savedScrollRef = useRef<number | null>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== allowedOrigin) return
      const data = e.data as Partial<DraftMessage> | null
      if (!data || typeof data !== "object") return
      if (data.type === "preview:draft" && data.version === 1) {
        const page = data.payload?.page
        if (page && Array.isArray(page.blocks)) {
          // Capture scroll BEFORE setDraft so React's commit can restore it.
          savedScrollRef.current = window.scrollY
          setDraft({ blocks: page.blocks })
        }
      }
    }

    window.addEventListener("message", onMessage)

    // Send ready handshake to parent.
    if (window.parent !== window) {
      window.parent.postMessage({ type: "preview:ready", version: 1 }, allowedOrigin)
    }

    // Heartbeat every 30s.
    const heartbeat = window.setInterval(() => {
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: "preview:heartbeat", version: 1, ts: Date.now() },
          allowedOrigin,
        )
      }
    }, 30000)

    return () => {
      window.removeEventListener("message", onMessage)
      clearInterval(heartbeat)
    }
  }, [allowedOrigin])

  // Restore scroll position after each draft commit. useLayoutEffect runs
  // synchronously after DOM updates, so the user doesn't see a flash of
  // top-scrolled content before the restore.
  useLayoutEffect(() => {
    if (savedScrollRef.current != null) {
      window.scrollTo(0, savedScrollRef.current)
      savedScrollRef.current = null
    }
  }, [draft])

  if (!draft) return null

  return <PreactBlocks blocks={draft.blocks} cmsOrigin={cmsOrigin} />
}

// PreactBlocks: Preact-side mirror of Blocks.astro. Used only inside
// the preview island; production tenant pages use Blocks.astro directly.
function PreactBlocks({ blocks, cmsOrigin }: { blocks: Block[]; cmsOrigin: string }) {
  // Preview-mode resolver: prefer populated url (Payload depth>=1 returns
  // full Media objects); otherwise fall back to CMS-origin id-based path.
  const resolveMedia = (ref: MediaRef): string | null => {
    if (ref == null) return null
    if (typeof ref === "object" && "url" in ref && ref.url) {
      // Populated Media object — use its url. If url is relative (e.g.
      // "/api/media/file/hero.png"), prepend cmsOrigin.
      return ref.url.startsWith("http") ? ref.url : `${cmsOrigin}${ref.url}`
    }
    // Bare id — no extension info; admin sends populated objects in
    // production. Return null gracefully.
    return null
  }

  return (
    <>
      {blocks.map((block, i) => (
        <BlockErrorBoundary key={i} blockType={block.blockType}>
          <PreactBlock block={block} resolveMedia={resolveMedia} />
        </BlockErrorBoundary>
      ))}
    </>
  )
}

function PreactBlock({
  block,
  resolveMedia,
}: {
  block: Block
  resolveMedia: (ref: MediaRef) => string | null
}) {
  if (block.blockType === "hero") {
    return (
      <Hero
        eyebrow={block.eyebrow}
        headline={block.headline}
        subheadline={block.subheadline}
        cta={block.cta}
        imageUrl={resolveMedia(block.image as MediaRef)}
      />
    )
  }
  if (block.blockType === "richText") {
    return <RichText body={block.body} />
  }
  if (block.blockType === "cta") {
    return (
      <CTA
        headline={block.headline}
        description={block.description}
        primary={block.primary}
        secondary={block.secondary}
      />
    )
  }
  if (block.blockType === "featureList") {
    return (
      <FeatureList
        title={block.title}
        intro={block.intro}
        features={block.features}
      />
    )
  }
  if (block.blockType === "testimonials") {
    const items = block.items.map((it) => ({
      quote: it.quote,
      author: it.author,
      role: it.role,
      avatarUrl: resolveMedia(it.avatar as MediaRef),
    }))
    return <Testimonials title={block.title} items={items} />
  }
  if (block.blockType === "faq") {
    return <FAQ title={block.title} items={block.items} />
  }
  if (block.blockType === "contactSection") {
    return (
      <ContactSection
        title={block.title}
        description={block.description}
        formName={block.formName}
        fields={block.fields}
      />
    )
  }
  return null
}
