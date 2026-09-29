const C39: Record<string, string> = {
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
  A: "wnnnnwnnw", B: "nnwnnwnnw", C: "wnwnnwnnn", D: "nnnnwwnnw", E: "wnnnwwnnn", F: "nnwnwwnnn", G: "nnnnnwwnw", H: "wnnnnwwnn", I: "nnwnnwwnn", J: "nnnnwwwnn",
  K: "wnnnnnnww", L: "nnwnnnnww", M: "wnwnnnnwn", N: "nnnnwnnww", O: "wnnnwnnwn", P: "nnwnwnnwn", Q: "nnnnnnwww", R: "wnnnnnwwn", S: "nnwnnnwwn", T: "nnnnwnwwn",
  U: "wwnnnnnnw", V: "nwwnnnnnw", W: "wwwnnnnnn", X: "nwnnwnnnw", Y: "wwnnwnnnn", Z: "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "*": "nwnnwnwnn",
};

/** Code39 barcode as SVG (no external dependency). */
export function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const text = value.toUpperCase().split("").filter((c) => C39[c] && c !== "*").join("");
  if (!text) return null;
  const seq = `*${text}*`.split("");
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of seq) {
    C39[ch].split("").forEach((e, i) => { const w = e === "w" ? 3 : 1; if (i % 2 === 0) bars.push({ x, w }); x += w; });
    x += 1;
  }
  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${x} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>{bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />)}</svg>
      <div dir="ltr" style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: 2 }}>{text}</div>
    </div>
  );
}

export type LabelConfig = {
  labelWidth: number; labelHeight: number; labelFontSize: number; labelShowBarcode: number; labelShowSender: number; labelShowItems: number; labelTemplate: string;
  senderName: string; senderAddress: string; siteName: string; senderPhone?: string; senderPostalCode?: string; senderCity?: string;
  labelShowLogo?: number; labelShowOrderBarcode?: number; labelBorderStyle?: string;
};
export type LabelData = Record<string, string> & { barcode: string };

export function fillLabel(t: string, d: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => d[k] ?? "");
}

/** Pure renderer shared by the print pages and the live designer. Templates are rendered as text (never raw HTML). */
export function LabelView({ cfg, data, items = [] }: { cfg: LabelConfig; data: LabelData; items?: string[] }) {
  const lines = fillLabel(cfg.labelTemplate, data).split("\n");
  const border = cfg.labelBorderStyle === "dashed" ? "2px dashed #000" : cfg.labelBorderStyle === "none" ? "none" : "2px solid #000";
  const fs = cfg.labelFontSize;
  return (
    <div className="label-sheet mx-auto overflow-hidden bg-white text-black" style={{ width: `${cfg.labelWidth}mm`, height: `${cfg.labelHeight}mm`, fontSize: fs, padding: "4mm", direction: "rtl", fontFamily: "Vazirmatn, sans-serif", border, pageBreakAfter: "always", breakAfter: "page" }}>
      <div className="flex items-center justify-between border-b-2 border-black pb-1">
        <div className="flex items-center gap-1.5">{cfg.labelShowLogo ? <span style={{ width: fs + 12, height: fs + 12, fontSize: fs }} className="grid place-items-center rounded bg-black font-black text-white">ی</span> : null}<b style={{ fontSize: fs + 4 }}>{cfg.siteName}</b></div>
        <span style={{ fontSize: fs - 1 }}>{data.date}</span>
      </div>
      {cfg.labelShowSender ? (
        <div className="border-b border-dashed border-black py-1" style={{ fontSize: fs - 1, lineHeight: 1.6 }}>
          <b>فرستنده:</b> {data.sender || cfg.senderName}
          <div>{data.senderAddress || `${cfg.senderCity ?? ""} ${cfg.senderAddress}`}</div>
          <div>{cfg.senderPhone ? `تلفن: ${data.senderPhone || cfg.senderPhone}` : ""}{cfg.senderPostalCode ? ` — کد پستی: ${data.senderPostalCode || cfg.senderPostalCode}` : ""}</div>
        </div>
      ) : null}
      <div className="space-y-0.5 py-1.5" style={{ lineHeight: 1.7 }}>
        {lines.map((l, i) => {
          if (l.trim() === "---") return <hr key={i} className="my-1 border-black" />;
          if (l.startsWith("# ")) return <div key={i} style={{ fontSize: fs + 3, fontWeight: 800 }}>{l.slice(2)}</div>;
          if (l.startsWith("! ")) return <div key={i} className="my-1 border-2 border-black px-2 py-0.5 text-center font-bold">{l.slice(2)}</div>;
          return <div key={i}>{l}</div>;
        })}
      </div>
      {cfg.labelShowItems && items.length ? <div className="border-t border-dashed border-black pt-1" style={{ fontSize: fs - 2 }}>{items.map((x, i) => <div key={i}>• {x}</div>)}</div> : null}
      <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: cfg.labelShowBarcode && cfg.labelShowOrderBarcode ? "1fr 1fr" : "1fr" }}>
        {cfg.labelShowBarcode ? <Barcode value={data.barcode} /> : null}
        {cfg.labelShowOrderBarcode && data.order ? <Barcode value={data.order} height={30} /> : null}
      </div>
    </div>
  );
}
