import sanitizeHtml from "sanitize-html";

/** Keeps image/link markup and layout attributes, while excluding executable content. */
export function sanitizeFooterHtml(html: string) {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "details", "summary"],
    allowedAttributes: {
      "*": ["class", "style", "title", "dir"],
      a: ["href", "target", "rel", "aria-label", "class", "style", "title"],
      img: ["src", "alt", "width", "height", "style", "class", "loading", "referrerpolicy", "title"],
    },
    allowedSchemes: ["https", "mailto", "tel"], allowedSchemesByTag: { img: ["https"] }, allowProtocolRelative: false,
    allowedStyles: { "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i], "background-color": [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i],
      width: [/^(\d{1,4}(px|%|rem)|auto)$/], height: [/^(\d{1,4}(px|%|rem)|auto)$/],
      "max-width": [/^\d{1,4}(px|%|rem)$/], "max-height": [/^\d{1,4}(px|%|rem)$/],
      display: [/^(block|inline|inline-block|flex|grid)$/],
      gap: [/^\d{1,3}(px|rem|em)$/], "flex-wrap": [/^(wrap|nowrap)$/], "align-items": [/^(center|start|end|stretch)$/], "justify-content": [/^(center|start|end|space-between|space-around)$/], "font-weight": [/^(normal|bold|[1-9]00)$/], "text-align": [/^(right|left|center|justify)$/],
      margin: [/^[\d.]+(px|rem|em)(\s+[\d.]+(px|rem|em)){0,3}$/, /^auto$/], padding: [/^[\d.]+(px|rem|em)(\s+[\d.]+(px|rem|em)){0,3}$/],
      "font-size": [/^\d{1,2}(px|rem|em)$/], "border-radius": [/^\d{1,3}(px|%)$/], cursor: [/^pointer$/],
    } },
    transformTags: { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, ...(attribs.target ? { target: "_blank", rel: "noopener noreferrer" } : {}) } }) },
  });
}
