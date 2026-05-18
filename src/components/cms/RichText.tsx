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
