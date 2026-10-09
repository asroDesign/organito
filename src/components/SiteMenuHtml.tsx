/** HTML is sanitized on write. Preserve its tags, links and individual images as authored. */
export function SiteMenuHtml({ html, label, className = "" }: { html: string; label: string; className?: string }) {
  return <div aria-label={label || undefined} className={`min-w-0 max-w-full [&_img]:max-w-full [&_img]:object-contain ${className}`} dangerouslySetInnerHTML={{ __html: html }}/>;
}
