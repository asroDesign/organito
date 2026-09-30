import sharp, { type Gravity } from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { getSettings } from "./settings";
import { readMediaFile } from "./media-storage";

const positions = new Set<Gravity>(["northwest", "north", "northeast", "west", "center", "east", "southwest", "south", "southeast"]);
const escapeXml = (s: string) => s.replace(/[<>&'\"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '\"': "&quot;" }[c]!));

export async function applyUploadWatermark(input: Buffer, mime: string, kind: string) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime) || ["profile", "document"].includes(kind)) return input;
  const s = await getSettings();
  if (!s.watermarkEnabled) return input;
  const base = sharp(input, { failOn: "error" }).rotate();
  const info = await base.metadata();
  const width = info.width ?? 1200, overlayWidth = Math.max(90, Math.min(360, Math.round(width * .22)));
  const opacity = Math.max(.1, Math.min(1, Number(s.watermarkOpacity) / 100));
  let overlay: Buffer | null = null;
  if (Number(s.watermarkImageId) > 0) {
    const [m] = await db.select({ storagePath: media.storagePath, mime: media.mime }).from(media).where(eq(media.id, Number(s.watermarkImageId)));
    if (m?.mime.startsWith("image/")) {
      try { overlay = await sharp(await readMediaFile(m.storagePath)).resize({ width: overlayWidth, withoutEnlargement: true }).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer(); } catch { overlay = null; }
    }
  }
  if (!overlay && String(s.watermarkText).trim()) {
    const text = escapeXml(String(s.watermarkText).trim().slice(0, 80));
    overlay = Buffer.from(`<svg width="${overlayWidth}" height="72" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" rx="18" fill="rgba(0,0,0,${(opacity * .45).toFixed(2)})"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" direction="rtl" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="rgba(255,255,255,${opacity.toFixed(2)})">${text}</text></svg>`);
  }
  if (!overlay) return input;
  const gravity = positions.has(s.watermarkPosition as Gravity) ? s.watermarkPosition as Gravity : "southeast";
  const result = base.composite([{ input: overlay, gravity }]);
  if (mime === "image/jpeg") return result.jpeg({ quality: 90 }).toBuffer();
  if (mime === "image/webp") return result.webp({ quality: 90 }).toBuffer();
  return result.png({ compressionLevel: 8 }).toBuffer();
}
