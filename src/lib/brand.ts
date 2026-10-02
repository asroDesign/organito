/** Replace legacy store branding and supported placeholders at render/send time. */
const legacyBrand = String.fromCharCode(1587, 1576, 1586, 1740, 1606, 1607);

export function siteBrandText(value: string | null | undefined, siteName: string): string {
  return (value ?? "").replace(/\{\{\s*(?:siteName|shop)\s*\}\}/g, siteName).split(legacyBrand).join(siteName);
}
