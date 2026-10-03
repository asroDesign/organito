import type { CSSProperties, ReactNode } from "react";
import type { SitePageBlock } from "@/db/schema";
import styles from "./PageBlockFrame.module.css";

export function PageBlockFrame({ block, children }: { block: SitePageBlock; children: ReactNode }) {
  if (block.enabled === false) return null;
  const s = block.style ?? {};
  const vars = { "--block-bg": s.background, "--block-color": s.color, "--block-accent": s.accent, "--block-padding": s.padding === undefined ? undefined : `${s.padding}px`, "--block-mobile-padding": s.paddingMobile === undefined ? undefined : `${s.paddingMobile}px`, "--block-radius": s.radius === undefined ? undefined : `${s.radius}px`, "--block-gap": s.gap === undefined ? undefined : `${s.gap}px`, "--block-columns": s.columns, "--block-mobile-columns": s.mobileColumns, textAlign: s.align, minHeight: s.minHeight, marginBottom: s.marginBottom } as CSSProperties;
  return <div id={block.anchor || undefined} data-builder-block={block.id} className={`${styles.frame} ${s.width === "full" || (block.type === "store_section" && block.sectionId === "hero" && !s.width) ? styles.full : ""} ${s.hideMobile ? styles.hideMobile : ""} ${s.hideDesktop ? styles.hideDesktop : ""}`} style={vars} data-background={s.background || undefined} data-color={s.color || undefined} data-accent={s.accent || undefined} data-padding={s.padding !== undefined || undefined} data-mobile-padding={s.paddingMobile !== undefined || undefined} data-radius={s.radius !== undefined || undefined} data-columns={s.columns || undefined} data-mobile-columns={s.mobileColumns || undefined} data-gap={s.gap !== undefined || undefined}>{children}</div>;
}
