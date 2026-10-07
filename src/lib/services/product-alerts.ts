import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { productAlertDeliveries, productAlertEvents, productAlertSubscriptions, products, productVariants } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { sendDirectSms } from "@/lib/sms";

/** Drains database-triggered events after the response so inventory workflows never wait on SMS providers. */
export async function dispatchProductAlertEvents(limit = 8) {
  const pending = await db.select().from(productAlertEvents).where(eq(productAlertEvents.status, "pending")).orderBy(productAlertEvents.createdAt).limit(limit);
  for (const event of pending) {
    const [claimed] = await db.update(productAlertEvents).set({ status: "processing" }).where(and(eq(productAlertEvents.id, event.id), eq(productAlertEvents.status, "pending"))).returning({ id: productAlertEvents.id });
    if (!claimed) continue;
    try {
      const [product] = await db.select({ name: products.nameFa, slug: products.slug }).from(products).where(eq(products.id, event.productId));
      if (!product) { await db.update(productAlertEvents).set({ status: "done", processedAt: new Date() }).where(eq(productAlertEvents.id, event.id)); continue; }
      const eligible = event.variantId > 0
        ? or(eq(productAlertSubscriptions.variantId, 0), eq(productAlertSubscriptions.variantId, event.variantId))
        : eq(productAlertSubscriptions.variantId, 0);
      const subscriptions = await db.select({ id: productAlertSubscriptions.id, phone: productAlertSubscriptions.phone, token: productAlertSubscriptions.token })
        .from(productAlertSubscriptions)
        .where(and(eq(productAlertSubscriptions.productId, event.productId), eq(productAlertSubscriptions.active, true), eligible,
          event.eventType === "restock" ? eq(productAlertSubscriptions.alertRestock, true) : eq(productAlertSubscriptions.alertPriceDrop, true)));
      const settings = await getSettings();
      for (const sub of subscriptions) {
        const [reservation] = await db.insert(productAlertDeliveries).values({ eventId: event.id, subscriptionId: sub.id, status: "pending" }).onConflictDoNothing().returning({ id: productAlertDeliveries.id });
        if (!reservation) continue;
        const productUrl = `${settings.siteUrl.replace(/\/$/, "")}/products/${product.slug}`;
        const unsubscribe = `${settings.siteUrl.replace(/\/$/, "")}/customer/alerts?unsubscribe=${encodeURIComponent(sub.token)}`;
        const status = await sendDirectSms(event.eventType === "restock" ? "product_restock" : "product_price_drop", sub.phone,
          event.eventType === "restock" ? "محصول {product} که پیگیرش بودید موجود شد: {url} لغو: {unsubscribe}" : "قیمت {product} کاهش یافت و اکنون {price} است: {url} لغو: {unsubscribe}",
          { product: product.name, price: Number(event.newPrice ?? 0), url: productUrl, unsubscribe });
        await db.update(productAlertDeliveries).set({ status, response: status, processedAt: new Date() }).where(eq(productAlertDeliveries.id, reservation.id));
      }
      await db.update(productAlertEvents).set({ status: "done", processedAt: new Date() }).where(eq(productAlertEvents.id, event.id));
    } catch (error) {
      console.error("Product alert event processing failed", { eventId: event.id, error });
      await db.update(productAlertEvents).set({ status: "failed", processedAt: new Date() }).where(eq(productAlertEvents.id, event.id)).catch(() => undefined);
    }
  }
}
