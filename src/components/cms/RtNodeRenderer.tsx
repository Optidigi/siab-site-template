import type {
  RtInline,
  RtNode,
  RtText,
} from "../../lib/types"

export function RtNodeRenderer({ node }: { node: RtNode | null | undefined }) {
  if (!node) return null
  switch (node.t) {
    case "root":
      return <>{node.children.map((c, i) => <RtNodeRenderer key={i} node={c} />)}</>
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
        {renderInlineChildren(node.children)}
      </a>
    case "themed":
      return <div class={`rt-themed rt-themed-${node.id}`} data-rt-id={node.id}>
        {(node.children ?? []).map((c, i) => <RtNodeRenderer key={i} node={c} />)}
      </div>
    case "text":
      return <RtTextNode node={node} />
  }
}

function renderInlineChildren(children: RtInline[]) {
  return children.map((c, i) => <RtNodeRenderer key={i} node={c} />)
}

function RtTextNode({ node }: { node: RtText }) {
  const text = node.v ?? ""
  let out: any = text
  if (node.marks?.includes("code"))          out = <code class="rt-code">{out}</code>
  if (node.marks?.includes("strikethrough")) out = <s class="rt-s">{out}</s>
  if (node.marks?.includes("underline"))     out = <u class="rt-u">{out}</u>
  if (node.marks?.includes("italic"))        out = <em class="rt-i">{out}</em>
  if (node.marks?.includes("bold"))          out = <strong class="rt-b">{out}</strong>
  if (node.color)                            out = <span class={`rt-color-${node.color}`}>{out}</span>
  if (node.style)                            out = <span class={`rt-type-${node.style}`}>{out}</span>
  return <>{out}</>
}
