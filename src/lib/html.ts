import sanitizeHtml from "sanitize-html";

/** Whitelist sanitizer for rich product content (CKEditor output). Only internal media or https images; iframes only from trusted video hosts. */
export function sanitizeRich(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "h2", "h3", "h4", "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark", "blockquote", "code", "pre", "span",
      "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col", "div", "iframe", "oembed",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"], img: ["src", "alt", "width", "height", "style"], figure: ["class", "style"], table: ["class"], td: ["colspan", "rowspan", "style"], th: ["colspan", "rowspan", "style"],
      span: ["style", "class"], p: ["style", "class"], h2: ["style"], h3: ["style"], h4: ["style"], li: ["style"], div: ["class"], mark: ["class"], col: ["style"],
      iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "allow"], oembed: ["url"], code: ["class"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^hsla?\([\d\s.,%]+\)$/i], "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^hsla?\([\d\s.,%]+\)$/i],
        "text-align": [/^(left|right|center|justify)$/], "font-size": [/^\d{1,2}(px|em|rem|%)$/], width: [/^\d{1,4}(px|%)$/], height: [/^\d{1,4}(px|%)$/], "font-family": [/^[\w\s,'"-]{1,80}$/],
      },
    },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.aparat.com", "aparat.com", "www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
    transformTags: {
      a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, rel: "noopener noreferrer nofollow", ...(attribs.target ? { target: "_blank" } : {}) } }),
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !/^(\/api\/media\/\d+|https:\/\/)/.test(frame.attribs.src ?? ""),
  }).replace(/<img([^>]*?)src="(\/api\/media\/\d+)"/g, '<img$1src="$2" loading="lazy"');
}

/** True if the text already contains HTML markup (legacy plain-text descriptions are rendered with line breaks). */
export const isHtml = (s: string | null | undefined) => !!s && /<\/?(p|h[2-4]|ul|ol|li|strong|table|figure|br|blockquote)\b/i.test(s);

export function toSafeHtml(s: string | null | undefined): string {
  if (!s) return "";
  if (isHtml(s)) return sanitizeRich(s);
  return s.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`).join("");
}

export function stripHtml(s: string | null | undefined, max = 300) {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
