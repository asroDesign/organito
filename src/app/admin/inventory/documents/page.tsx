import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { InventoryDocumentsClient } from "@/components/InventoryDocumentsClient";
export default async function Page(){
 await requirePage({perm:"INVENTORY_MANAGE"});
 return <><PageHeader title="صورتحساب‌های انبار" subtitle="خرید، دریافت امانی و تعدیل چندقلمی با شماره سند مشترک" actions={<Link href="/admin/inventory" className="btn-ghost">بازگشت به انبار</Link>}/><Card title="رسیدها و صورتحساب‌ها"><InventoryDocumentsClient/></Card></>;
}
