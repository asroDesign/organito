"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { SitePageBlock } from "@/db/schema";
import type { HomeData } from "@/lib/home-data";
import { HomeContent } from "./HomeContent";
export function HomeBuilderPreview({ initial, data, header, footer }: { initial: SitePageBlock[]; data: HomeData; header: ReactNode; footer: ReactNode }) {
  const [blocks, setBlocks] = useState(initial), [selected, setSelected] = useState("");
  const [products, setProducts] = useState(data.all);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== parent) return;
      if (event.data?.type === "home-builder:update" && Array.isArray(event.data.blocks)) { setBlocks(event.data.blocks); if (Array.isArray(event.data.products)) setProducts(event.data.products); }
      if (event.data?.type === "home-builder:select" && typeof event.data.id === "string") {
        setSelected(event.data.id);
        const node = [...document.querySelectorAll<HTMLElement>("[data-builder-block]")].find(n => n.dataset.builderBlock === event.data.id);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    window.addEventListener("message", listener);
    parent.postMessage({ type: "home-builder:ready" }, location.origin);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-builder-block]").forEach(node => { node.style.outline = node.dataset.builderBlock === selected ? "3px solid #f59e0b" : ""; node.style.outlineOffset = "-3px"; });
  }, [selected, blocks]);
  return <div onSubmitCapture={e => { if ((e.target as HTMLElement).closest("[data-builder-interactive]")) return; e.preventDefault(); e.stopPropagation(); }} onClickCapture={e => {
    if ((e.target as HTMLElement).closest("[data-builder-interactive]")) return;
    e.preventDefault(); e.stopPropagation();
    const node = (e.target as HTMLElement).closest<HTMLElement>("[data-builder-block]");
    if (node) { const id = node.dataset.builderBlock || ""; setSelected(id); parent.postMessage({ type: "home-builder:selected", id }, location.origin); }
  }}><style>{`[data-builder-block]:hover { outline: 2px dashed #fbbf24; outline-offset: -2px; cursor: pointer; } body { overflow-x: hidden; }`}</style>{header}<HomeContent blocks={blocks} data={{ ...data, all: products }}/>{footer}</div>;
}
