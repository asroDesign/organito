"use client";

import { useEffect } from "react";

/** Runs trusted administrator-provided footer embeds after the public footer mounts. */
export function FooterScripts({ code }: { code: string }) {
  useEffect(() => {
    const page = window as Window & { __footerScriptsCode?: string; __footerScriptsHost?: HTMLDivElement };
    if (!code.trim()) {
      page.__footerScriptsHost?.remove();
      delete page.__footerScriptsHost;
      delete page.__footerScriptsCode;
      return;
    }
    if (page.__footerScriptsCode === code && page.__footerScriptsHost?.isConnected) return;
    page.__footerScriptsHost?.remove();

    const host = document.createElement("div");
    host.dataset.siteFooterIntegration = "true";
    const template = document.createElement("template");
    template.innerHTML = code;

    const appendActive = (parent: Node, source: Node) => {
      if (source instanceof HTMLScriptElement) {
        const script = document.createElement("script");
        for (const attribute of Array.from(source.attributes)) script.setAttribute(attribute.name, attribute.value);
        script.textContent = source.textContent;
        parent.appendChild(script);
        return;
      }

      const node = source.cloneNode(false);
      parent.appendChild(node);
      for (const child of Array.from(source.childNodes)) appendActive(node, child);
    };

    for (const node of Array.from(template.content.childNodes)) appendActive(host, node);
    document.body.appendChild(host);
    page.__footerScriptsCode = code;
    page.__footerScriptsHost = host;
  }, [code]);

  return null;
}
