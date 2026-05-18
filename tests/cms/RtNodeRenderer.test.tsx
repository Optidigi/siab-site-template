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
