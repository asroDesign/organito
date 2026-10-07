import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, pickupCenters, users } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { FeatureIntro, PageHeader } from "@/components/ui";
import { PickupManager } from "@/components/PickupManager";
import { MapPin } from "lucide-react";

export default async function PickupCentersPage() {
  await requirePage({ perm: "SHIPMENTS_MANAGE" });
  let centers: (typeof pickupCenters.$inferSelect)[] = [];
  let pickupOrders: { id: number; number: string; status: string; paymentStatus: string; total: number | null; pickupCenterId: number | null; pickupCenterName: string | null; pickupDate: string | null; pickupTime: string | null; pickupCode: string | null; pickupStatus: string | null; pickupReadyAt: Date | null; pickupCompletedAt: Date | null; customerName: string; customerPhone: string; createdAt: Date }[] = [];
  let databaseReady = true;
  try {
    [centers, pickupOrders] = await Promise.all([
      db.select().from(pickupCenters).orderBy(desc(pickupCenters.updatedAt)),
      db.select({ id: orders.id, number: orders.number, status: orders.status, paymentStatus: orders.paymentStatus, total: orders.total, pickupCenterId: orders.pickupCenterId, pickupCenterName: orders.pickupCenterName, pickupDate: orders.pickupDate, pickupTime: orders.pickupTime, pickupCode: orders.pickupCode, pickupStatus: orders.pickupStatus, pickupReadyAt: orders.pickupReadyAt, pickupCompletedAt: orders.pickupCompletedAt, customerName: users.name, customerPhone: users.phone, createdAt: orders.createdAt }).from(orders).innerJoin(users, eq(users.id, orders.customerId)).where(eq(orders.fulfillmentType, "pickup")).orderBy(desc(orders.createdAt)).limit(100),
    ]);
  } catch (error) {
    console.error("Pickup center tables are not available in the application database yet.", error);
    databaseReady = false;
  }
  return <><PageHeader title="مراکز دریافت حضوری" subtitle="نشانی و ساعت کاری مراکز، ظرفیت روزانه و آماده‌سازی سفارش برای تحویل"/><FeatureIntro className="my-5" icon={MapPin} title="دریافت حضوری" text={databaseReady ? "مشتری می‌تواند برای سفارش‌های انبار مرکزی روز و ساعت دریافت رزرو کند؛ پس از پرداخت، سفارش از همین صفحه آماده و تحویل می‌شود." : "پیش‌نمایش مدیریت آماده است؛ برای ذخیره مراکز و رزروهای دریافت، migration افزایشی 0049_pickup_centers.sql باید روی دیتابیس runtime اجرا شود."} tone={databaseReady ? "green" : "yellow"}/><PickupManager initialCenters={centers} initialOrders={pickupOrders} databaseReady={databaseReady}/></>;
}
