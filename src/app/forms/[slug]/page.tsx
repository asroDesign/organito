import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { publicForms } from "@/db/schema";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PublicFormView } from "@/components/PublicFormView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [form] = await db.select({ title: publicForms.title, description: publicForms.description }).from(publicForms).where(and(eq(publicForms.slug, slug), eq(publicForms.status, "published")));
  return { title: form?.title ?? "فرم", description: form?.description ?? undefined, robots: { index: false, follow: false } };
}

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [form] = await db.select({ title: publicForms.title, slug: publicForms.slug, description: publicForms.description, fields: publicForms.fields, submitLabel: publicForms.submitLabel, successMessage: publicForms.successMessage, privacyNotice: publicForms.privacyNotice }).from(publicForms).where(and(eq(publicForms.slug, slug), eq(publicForms.status, "published")));
  if (!form) notFound();
  return <><SiteHeader/><PublicFormView form={form}/><SiteFooter/></>;
}
