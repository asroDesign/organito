import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { publicForms, publicFormSubmissions, type PublicFormField, type PublicFormValues } from "@/db/schema";
import { audit } from "@/lib/audit";
import { rateLimit, requireApi } from "@/lib/auth";
import { HttpError, int, str } from "@/lib/util";
import { body, idParam, type Route } from "./router";

const FIELD_TYPES = new Set<PublicFormField["type"]>(["text", "textarea", "email", "phone", "number", "select", "checkbox", "consent"]);
const FORM_STATUSES = new Set(["draft", "published", "archived"]);

function parseFields(value: unknown): PublicFormField[] {
  if (!Array.isArray(value) || value.length > 40) throw new HttpError(400, "فرم باید حداکثر ۴۰ فیلد داشته باشد");
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, `فیلد ${index + 1} معتبر نیست`);
    const item = raw as Record<string, unknown>;
    const id = str(item.id, 50).trim(), label = str(item.label, 120).trim(), type = item.type as PublicFormField["type"];
    if (!/^[a-zA-Z][a-zA-Z\d_-]{0,49}$/.test(id) || ids.has(id)) throw new HttpError(400, "شناسه فیلدها باید یکتا و معتبر باشد");
    if (label.length < 1 || !FIELD_TYPES.has(type)) throw new HttpError(400, `عنوان یا نوع فیلد ${index + 1} معتبر نیست`);
    ids.add(id);
    const field: PublicFormField = { id, label, type, required: item.required === true };
    const placeholder = str(item.placeholder, 160).trim();
    if (placeholder) field.placeholder = placeholder;
    if (type === "select") {
      if (!Array.isArray(item.options) || item.options.length < 1 || item.options.length > 30) throw new HttpError(400, `گزینه‌های فیلد «${label}» را کامل کنید`);
      const options = item.options.map((option) => {
        if (!option || typeof option !== "object" || Array.isArray(option)) throw new HttpError(400, "گزینه فرم معتبر نیست");
        const o = option as Record<string, unknown>, optionValue = str(o.value, 120).trim(), optionLabel = str(o.label, 120).trim();
        if (!optionValue || !optionLabel) throw new HttpError(400, "مقدار و عنوان تمام گزینه‌ها الزامی است");
        return { value: optionValue, label: optionLabel };
      });
      if (new Set(options.map((option) => option.value)).size !== options.length) throw new HttpError(400, `گزینه تکراری در «${label}» وجود دارد`);
      field.options = options;
    }
    if (type === "text" || type === "textarea") field.maxLength = int(item.maxLength ?? (type === "text" ? 250 : 3000), 1, type === "text" ? 2000 : 10000);
    return field;
  });
}

function parseForm(value: Record<string, unknown>) {
  const title = str(value.title, 140).trim(), slug = str(value.slug, 80).trim().toLowerCase();
  const status = String(value.status ?? "draft");
  const fields = parseFields(value.fields);
  if (title.length < 2) throw new HttpError(400, "عنوان فرم باید دست‌کم دو نویسه باشد");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) throw new HttpError(400, "نشانی فرم باید فقط از حروف انگلیسی کوچک، عدد و خط تیره تشکیل شود");
  if (!FORM_STATUSES.has(status)) throw new HttpError(400, "وضعیت فرم معتبر نیست");
  if (status === "published" && !fields.length) throw new HttpError(400, "برای انتشار، دست‌کم یک فیلد اضافه کنید");
  return {
    title, slug, description: str(value.description, 2000).trim() || null, status,
    fields, submitLabel: str(value.submitLabel, 60).trim() || "ارسال پاسخ",
    successMessage: str(value.successMessage, 500).trim() || "پاسخ شما ثبت شد.",
    privacyNotice: str(value.privacyNotice, 1000).trim() || null,
  };
}

function csvCell(value: unknown) {
  let text = typeof value === "string" ? value : typeof value === "boolean" ? (value ? "بله" : "خیر") : value == null ? "" : String(value);
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function submissionValues(fields: PublicFormField[], raw: unknown): PublicFormValues {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, "پاسخ فرم معتبر نیست");
  const input = raw as Record<string, unknown>;
  const allowed = new Set(fields.map((field) => field.id));
  if (Object.keys(input).some((key) => !allowed.has(key)) || Object.keys(input).length > fields.length) throw new HttpError(400, "پاسخ شامل فیلد ناشناخته است");
  const values: PublicFormValues = {};
  for (const field of fields) {
    const rawValue = input[field.id];
    if (field.type === "checkbox" || field.type === "consent") {
      const checked = rawValue === true;
      if (field.required && !checked) throw new HttpError(400, `«${field.label}» الزامی است`);
      values[field.id] = checked;
      continue;
    }
    const value = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!value) {
      if (field.required) throw new HttpError(400, `«${field.label}» را وارد کنید`);
      values[field.id] = "";
      continue;
    }
    if (field.type === "select" && !field.options?.some((option) => option.value === value)) throw new HttpError(400, `گزینه «${field.label}» معتبر نیست`);
    if (field.type === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)) throw new HttpError(400, `ایمیل «${field.label}» معتبر نیست`);
    if (field.type === "phone" && !/^\+?[0-9۰-۹٠-٩()\-\s]{7,20}$/.test(value)) throw new HttpError(400, `شماره «${field.label}» معتبر نیست`);
    if (field.type === "number" && (!Number.isFinite(Number(value)) || value.length > 40)) throw new HttpError(400, `عدد «${field.label}» معتبر نیست`);
    const maximum = field.type === "text" || field.type === "textarea" ? field.maxLength ?? 3000 : 1000;
    if (value.length > maximum) throw new HttpError(400, `پاسخ «${field.label}» بیش از حد مجاز است`);
    values[field.id] = value;
  }
  return values;
}

export const formRoutes: Route[] = [
  { method: "GET", pattern: "admin/forms", handler: async () => {
    await requireApi("SETTINGS_MANAGE");
    const [forms, counts] = await Promise.all([
      db.select().from(publicForms).orderBy(desc(publicForms.updatedAt)).limit(500),
      db.select({ formId: publicFormSubmissions.formId, total: count() }).from(publicFormSubmissions).groupBy(publicFormSubmissions.formId),
    ]);
    const countByForm = new Map(counts.map((row) => [row.formId, row.total]));
    return forms.map((form) => ({ ...form, responseCount: countByForm.get(form.id) ?? 0 }));
  } },
  { method: "POST", pattern: "admin/forms", handler: async (req, _params, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), values = parseForm(await body(req));
    const [row] = await db.insert(publicForms).values({ ...values, createdBy: user.id }).returning();
    await audit(db, { userId: user.id, ...meta }, "public_form.create", "public_form", row.id, null, row);
    return { ...row, responseCount: 0 };
  } },
  { method: "PUT", pattern: "admin/forms/:id", handler: async (req, params, meta) => {
    const user = await requireApi("SETTINGS_MANAGE"), id = idParam(params.id), values = parseForm(await body(req));
    const [old] = await db.select().from(publicForms).where(eq(publicForms.id, id));
    if (!old) throw new HttpError(404, "فرم پیدا نشد");
    const [row] = await db.update(publicForms).set({ ...values, updatedAt: new Date() }).where(eq(publicForms.id, id)).returning();
    await audit(db, { userId: user.id, ...meta }, "public_form.update", "public_form", row.id, old, row);
    const [result] = await db.select({ total: count() }).from(publicFormSubmissions).where(eq(publicFormSubmissions.formId, id));
    return { ...row, responseCount: result?.total ?? 0 };
  } },
  { method: "GET", pattern: "admin/forms/:id/submissions", handler: async (req, params) => {
    await requireApi("SETTINGS_MANAGE");
    const id = idParam(params.id), page = Math.max(1, int(req.nextUrl.searchParams.get("page") ?? 1, 1)), query = str(req.nextUrl.searchParams.get("q"), 100).trim();
    const [form] = await db.select({ id: publicForms.id }).from(publicForms).where(eq(publicForms.id, id));
    if (!form) throw new HttpError(404, "فرم پیدا نشد");
    const where = and(eq(publicFormSubmissions.formId, id), query ? sql`${publicFormSubmissions.values}::text ILIKE ${`%${query}%`}` : undefined);
    const [totalRow, items] = await Promise.all([
      db.select({ total: count() }).from(publicFormSubmissions).where(where),
      db.select().from(publicFormSubmissions).where(where).orderBy(desc(publicFormSubmissions.createdAt), desc(publicFormSubmissions.id)).limit(30).offset((page - 1) * 30),
    ]);
    return { items, page, pageSize: 30, total: totalRow[0]?.total ?? 0 };
  } },
  { method: "GET", pattern: "admin/forms/:id/export", handler: async (req, params) => {
    await requireApi("SETTINGS_MANAGE");
    const id = idParam(params.id), [form] = await db.select().from(publicForms).where(eq(publicForms.id, id));
    if (!form) throw new HttpError(404, "فرم پیدا نشد");
    const query = str(req.nextUrl.searchParams.get("q"), 100).trim();
    const rows = await db.select().from(publicFormSubmissions).where(and(eq(publicFormSubmissions.formId, id), query ? sql`${publicFormSubmissions.values}::text ILIKE ${`%${query}%`}` : undefined)).orderBy(desc(publicFormSubmissions.createdAt), desc(publicFormSubmissions.id)).limit(10000);
    const exportFields = [...form.fields];
    const knownFields = new Set(exportFields.map((field) => field.id));
    for (const row of rows) for (const field of row.schemaSnapshot) if (!knownFields.has(field.id)) { exportFields.push(field); knownFields.add(field.id); }
    const header = ["زمان ثبت", ...exportFields.map((field) => field.label)];
    const lines = [header, ...rows.map((row) => [row.createdAt.toISOString(), ...exportFields.map((field) => row.values[field.id] ?? "")])]
      .map((line) => line.map(csvCell).join(",")).join("\r\n");
    const filename = `form-${form.slug}-responses.csv`;
    return new Response(`\uFEFF${lines}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } },
  { method: "GET", pattern: "forms/:slug", handler: async (_req, params) => {
    const slug = str(params.slug, 80).toLowerCase();
    const [form] = await db.select({ title: publicForms.title, slug: publicForms.slug, description: publicForms.description, fields: publicForms.fields, submitLabel: publicForms.submitLabel, successMessage: publicForms.successMessage, privacyNotice: publicForms.privacyNotice }).from(publicForms).where(and(eq(publicForms.slug, slug), eq(publicForms.status, "published")));
    if (!form) throw new HttpError(404, "فرم فعال پیدا نشد");
    return form;
  } },
  { method: "POST", pattern: "forms/:slug/submissions", handler: async (req, params, meta) => {
    const slug = str(params.slug, 80).toLowerCase();
    rateLimit(`public-form:${meta.ip}:${slug}`, 5, 10 * 60_000);
    const payload = await body(req);
    const [form] = await db.select().from(publicForms).where(and(eq(publicForms.slug, slug), eq(publicForms.status, "published")));
    if (!form) throw new HttpError(404, "فرم فعال پیدا نشد");
    // Quiet honeypot: do not record likely automated submissions or disclose the trap.
    if (str(payload.website, 200).trim()) return { ok: true, message: form.successMessage };
    const values = submissionValues(form.fields, payload.values);
    await db.insert(publicFormSubmissions).values({ formId: form.id, values, schemaSnapshot: form.fields });
    return { ok: true, message: form.successMessage };
  } },
];
