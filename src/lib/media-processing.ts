import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { newMediaPath, removeMediaFile, writeMediaFile } from "./media-storage";

export type ImageCropRatio = "original" | "1:1" | "4:3" | "16:9" | "3:4";
export type ImageOutputFormat = "webp" | "avif" | "both";
export type ImageProcessingOptions = { cropRatio: ImageCropRatio; focalX: number; focalY: number; quality: number; format: ImageOutputFormat };
export type GeneratedMediaVariant = {
  variant: string; storagePath: string; mime: string; size: number; width: number; height: number;
  cropRatio: ImageCropRatio; focalX: number; focalY: number; quality: number;
};

const WIDTHS = [320, 640, 960, 1280, 1600] as const;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
const RATIOS: Record<Exclude<ImageCropRatio, "original">, number> = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9, "3:4": 3 / 4 };
const FORMATS = ["jpeg", "png", "webp"] as const;

export async function createImageVariants(mediaId: number, input: Buffer, options: ImageProcessingOptions): Promise<GeneratedMediaVariant[]> {
  if (input.length > MAX_INPUT_BYTES) throw new Error("برای جلوگیری از مصرف بیش از حد منابع، پردازش تصویرهای بزرگ‌تر از ۲۰ مگابایت ممکن نیست.");
  const metadata = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || !FORMATS.includes(metadata.format as typeof FORMATS[number])) throw new Error("فقط تصویر ثابت JPG، PNG و WebP قابل پردازش است.");
  if ((metadata.pages ?? 1) > 1) throw new Error("برای حفظ انیمیشن، فایل GIF یا تصویر چندصفحه‌ای پردازش نمی‌شود.");

  const normalized = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate().toBuffer({ resolveWithObject: true });
  const sourceWidth = normalized.info.width, sourceHeight = normalized.info.height;
  let left = 0, top = 0, cropWidth = sourceWidth, cropHeight = sourceHeight;
  if (options.cropRatio !== "original") {
    const ratio = RATIOS[options.cropRatio];
    if (sourceWidth / sourceHeight > ratio) {
      cropWidth = Math.max(1, Math.round(sourceHeight * ratio));
      left = Math.min(sourceWidth - cropWidth, Math.max(0, Math.round(sourceWidth * options.focalX / 100 - cropWidth / 2)));
    } else {
      cropHeight = Math.max(1, Math.round(sourceWidth / ratio));
      top = Math.min(sourceHeight - cropHeight, Math.max(0, Math.round(sourceHeight * options.focalY / 100 - cropHeight / 2)));
    }
  }

  const supportsAvif = Boolean(sharp.format.avif?.output?.file);
  const supportedFormats: Exclude<ImageOutputFormat, "both">[] = options.format === "both"
    ? ["webp", ...(supportsAvif ? ["avif" as const] : [])]
    : options.format === "avif" && !supportsAvif ? (() => { throw new Error("خروجی AVIF در نسخهٔ فعلی Sharp پشتیبانی نمی‌شود."); })() : [options.format];
  const output: GeneratedMediaVariant[] = [];
  const completedPaths: string[] = [];
  try {
    for (const width of WIDTHS) {
      const targetWidth = Math.min(width, cropWidth);
      if (output.some((item) => item.width === targetWidth)) continue;
      for (const format of supportedFormats) {
        const variant = `${targetWidth}-${format}`;
        const path = newMediaPath(`${mediaId}-${randomUUID()}.${format}`);
        let pipeline = sharp(normalized.data, { failOn: "error", limitInputPixels: 40_000_000 });
        if (options.cropRatio !== "original") pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight });
        pipeline = options.cropRatio === "original"
          ? pipeline.resize({ width: targetWidth, withoutEnlargement: true })
          : pipeline.resize({ width: targetWidth, height: Math.max(1, Math.round(targetWidth / RATIOS[options.cropRatio])), fit: "cover", withoutEnlargement: true });
        const result = await pipeline.toFormat(format, format === "webp" ? { quality: options.quality, effort: 4 } : { quality: options.quality, effort: 4 }).toBuffer({ resolveWithObject: true });
        if (output.reduce((sum, item) => sum + item.size, 0) + result.data.length > MAX_OUTPUT_BYTES) throw new Error("حجم نسخه‌های خروجی از سقف ۶۴ مگابایت بیشتر شد؛ کیفیت پایین‌تر یا برش ساده‌تری انتخاب کنید.");
        await writeMediaFile(path, result.data);
        completedPaths.push(path);
        output.push({ variant, storagePath: path, mime: `image/${format}`, size: result.data.length, width: result.info.width, height: result.info.height, cropRatio: options.cropRatio, focalX: options.focalX, focalY: options.focalY, quality: options.quality });
      }
    }
    return output;
  } catch (error) {
    await Promise.all(completedPaths.map((path) => removeMediaFile(path)));
    throw error;
  }
}

export function preferredImageFormats(accept: string | null): string[] {
  const header = (accept ?? "").toLowerCase();
  return [...(header.includes("image/avif") ? ["avif"] : []), ...(header.includes("image/webp") ? ["webp"] : [])];
}
