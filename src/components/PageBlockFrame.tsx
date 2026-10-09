import type { CSSProperties, ReactNode } from "react";
import type { SitePageBlock } from "@/db/schema";
import styles from "./PageBlockFrame.module.css";
import { sanitizeSectionCss } from "@/lib/page-builder";

export function PageBlockFrame({ block, children }: { block: SitePageBlock; children: ReactNode }) {
  if (block.enabled === false) return null;
  const s = block.style ?? {};
  const vars = { "--block-bg": s.background, "--block-color": s.color, "--block-accent": s.accent, "--block-padding": s.padding === undefined ? undefined : `${s.padding}px`, "--block-mobile-padding": s.paddingMobile === undefined ? undefined : `${s.paddingMobile}px`, "--block-radius": s.radius === undefined ? undefined : `${s.radius}px`, "--block-gap": s.gap === undefined ? undefined : `${s.gap}px`, "--block-columns": s.columns, "--block-mobile-columns": s.mobileColumns, "--builder-mobile-cols": s.mobileColumns ?? 1, "--builder-tablet-cols": s.tabletColumns ?? s.columns ?? 2, "--builder-desktop-cols": s.columns ?? 3, textAlign: s.align, minHeight: s.minHeight, marginBottom: s.marginBottom } as CSSProperties;
  const scope = `pb-${(block.id || "section").replace(/[^\w-]/g, "")}`;
  let customCss = "", mobileCss = "";
  try { customCss = sanitizeSectionCss(s.customCss).replaceAll("&", `.${scope}`); mobileCss = sanitizeSectionCss(s.customCssMobile).replaceAll("&", `.${scope}`); } catch { /* Ignore untrusted legacy CSS instead of breaking page rendering. */ }
  return <div id={block.anchor || undefined} data-builder-block={block.id} className={`${styles.frame} ${scope} ${s.width === "full" || (block.type === "store_section" && block.sectionId === "hero" && !s.width) ? styles.full : ""} ${s.hideMobile ? styles.hideMobile : ""} ${s.hideDesktop ? styles.hideDesktop : ""}`} style={vars} data-background={s.background || undefined} data-color={s.color || undefined} data-accent={s.accent || undefined} data-padding={s.padding !== undefined || undefined} data-mobile-padding={s.paddingMobile !== undefined || undefined} data-radius={s.radius !== undefined || undefined} data-columns={s.columns || undefined} data-mobile-columns={s.mobileColumns || undefined} data-gap={s.gap !== undefined || undefined}>
    {(customCss || mobileCss) && <style>{`${customCss}${mobileCss ? `\n@media(max-width:767px){${mobileCss}}` : ""}`}</style>}{children}
  </div>;
}
