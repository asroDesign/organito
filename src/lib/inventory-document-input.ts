import { HttpError } from './util';

export function documentInteger(value: unknown, label: string, min = 0, max = 1_000_000_000_000): number {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') throw new HttpError(400, `${label} را وارد کنید`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new HttpError(400, `${label} نامعتبر است`);
  return n;
}
export function documentLines(value: unknown, adjustment = false) {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new HttpError(400, 'سند باید بین ۱ تا ۱۰۰ قلم داشته باشد');
  const seen = new Set<string>();
  return value.map(v => {
    if (!v || typeof v !== 'object') throw new HttpError(400, 'ردیف سند نامعتبر است');
    const row = v as Record<string, unknown>;
    const productId = documentInteger(row.productId, 'کالا', 1);
    const variantId = row.variantId === null || row.variantId === undefined ? null : documentInteger(row.variantId, 'تنوع', 1);
    const key = `${productId}:${variantId ?? 0}`;
    if (seen.has(key)) throw new HttpError(400, 'هر تنوع باید فقط در یک ردیف سند باشد');
    seen.add(key);
    const quantity = documentInteger(row.quantity, 'تعداد', adjustment ? -100000 : 1, 100000);
    if (!quantity) throw new HttpError(400, 'تعداد نمی‌تواند صفر باشد');
    return { productId, variantId, quantity, unitCost: documentInteger(row.unitCost ?? 0, 'بهای واحد') };
  }).sort((a,b) => a.productId-b.productId || (a.variantId ?? 0)-(b.variantId ?? 0));
}
/** Exact integer allocation: the sum of allocations always equals the invoice charge. */
export function allocateCharge(amount: number, weights: number[]) {
  const sum = weights.reduce((a,b)=>a+b,0);
  const basis = sum ? weights : weights.map(()=>1);
  const denominator = sum || weights.length;
  const result = basis.map(w=>Number(BigInt(amount)*BigInt(w)/BigInt(denominator)));
  let rest = amount-result.reduce((a,b)=>a+b,0);
  for(let i=0;rest>0;i++,rest--) result[i%result.length]++;
  return result;
}
