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
