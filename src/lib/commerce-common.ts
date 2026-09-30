import { HttpError, str } from './util';
import { g2j, todayIso } from './jalali';
export const phoneNumber=(v:unknown)=>str(v,30).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g,'').replace(/^0098|^98/,'0');
export function validPhone(v:unknown){const p=phoneNumber(v);if(!/^09\d{9}$/.test(p))throw new HttpError(400,'شماره همراه معتبر نیست');return p;}
export function dateOnly(v:unknown){if(!v)return null;const s=str(v,10);const d=new Date(`${s}T12:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s||s>todayIso())throw new HttpError(400,'تاریخ تولد معتبر نیست');return d;}
export function isJalaliBirthday(birth:Date,iso=todayIso()) {const a=g2j(birth.getUTCFullYear(),birth.getUTCMonth()+1,birth.getUTCDate());const b=g2j(...iso.split('-').map(Number) as [number,number,number]);return a[1]===b[1]&&a[2]===b[2];}
export const CAMPAIGN_TYPES={instant:'ارسال فوری',scheduled:'ارسال زمان‌بندی‌شده',birthday:'تولد شمسی',welcome:'عضویت مشتری',purchase:'خرید موفق',review:'دیدگاه تأییدشده'};
export const automaticTypes=['birthday','welcome','purchase','review'];
