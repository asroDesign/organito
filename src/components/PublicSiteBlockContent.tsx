import Link from "next/link";
import type { CSSProperties } from "react";
import type { SitePageBlock } from "@/db/schema";
import { PageBlockFrame } from "./PageBlockFrame";
import { RichContent } from "./RichContent";
import { SiteBlockContent } from "./SiteBlockContent";

/** Server-side page-builder renderer. It recursively resolves rich shortcodes, including those nested inside responsive columns. */
export function PublicSiteBlockContent({ block, primary = false }: { block: SitePageBlock; primary?: boolean }) {
  if (block.enabled === false) return null;

  if (block.type === "shortcode") {
    const Heading = primary ? "h1" : "h2";
    return <PageBlockFrame block={block}><section>{block.title && <Heading className="mb-3 text-2xl font-black">{block.title}</Heading>}{block.body && <RichContent content={block.body}/>}</section></PageBlockFrame>;
  }

  if (block.type === "columns") {
    const Heading = primary ? "h1" : "h2";
    const desktopColumns = block.style?.columns ?? Math.max(1, block.columns?.length ?? 1);
    const button = block.href && block.buttonLabel ? <Link className="btn-primary mt-5" href={block.href}>{block.buttonLabel}</Link> : null;
    return <PageBlockFrame block={block}><section className="site-builder-columns-wrap">{(block.title || block.body) && <div className="mb-5 max-w-3xl">{block.title && <Heading className="mb-3 text-2xl font-black">{block.title}</Heading>}{block.body && <p className="whitespace-pre-line text-sm leading-8 opacity-80">{block.body}</p>}</div>}<div className="site-builder-columns" style={{ "--builder-mobile-cols": block.style?.mobileColumns ?? 1, "--builder-tablet-cols": block.style?.tabletColumns ?? 2, "--builder-desktop-cols": desktopColumns, gap: block.style?.gap === undefined ? undefined : `${block.style.gap}px` } as CSSProperties}>{(block.columns ?? []).map((column, columnIndex) => <div key={column.id ?? columnIndex} data-builder-col-span={Math.min(column.desktopSpan ?? 1, desktopColumns)} className="site-builder-column min-w-0" style={{ order: column.mobileOrder ?? columnIndex }}>{column.blocks.filter(child => child.enabled !== false).map((child, childIndex) => <PublicSiteBlockContent key={child.id ?? childIndex} block={child}/>)}</div>)}</div>{button}</section></PageBlockFrame>;
  }

  return <PageBlockFrame block={block}><SiteBlockContent block={block} primary={primary}/></PageBlockFrame>;
}
