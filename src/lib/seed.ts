import { readFileSync, existsSync } from "fs";
import path from "path";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  accounts, categories, media, productImages, products, productVariants, sellerOffers, sellers, settings, smsTemplates,
  supplyQuotes, supplyRequests, ticketMessages, tickets, users, wallets, sellerShipments, ticketDepartments, detailAccounts, carriers, carrierRates, discountCodes, festivals, reviews, productQuestions, productAnswers,
} from "@/db/schema";
import { CHART, postJournal } from "./accounting";
import { DEFAULT_SETTINGS } from "./settings";
import { SMS_EVENTS } from "./sms";
import { normalizePn } from "./util";

let seeding: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seeding) seeding = run().then(ensureExtras).catch((e) => { seeding = null; console.error("seed failed", e); });
  return seeding;
}

async function run() {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
  if (Number(c) > 0) return;
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(99123)");
    const again = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    if (Number(again[0].c) > 0) return;
    await seed();
  } finally {
    await client.query("select pg_advisory_unlock(99123)");
    client.release();
  }
}

async function seed() {
  const { hashPassword } = await import("./auth");
  const svcOrders = await import("./services/orders");
  const svcCatalog = await import("./services/catalog");
  const svcWallet = await import("./services/wallet");
  const svcSupply = await import("./services/supply");

  await db.insert(settings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));
  const codeToId = new Map<string, number>();
  for (const a of CHART) {
    const [row] = await db.insert(accounts).values({ code: a.code, name: a.name, level: a.level, type: a.type, parentId: a.parent ? codeToId.get(a.parent) : null }).returning();
    codeToId.set(a.code, row.id);
  }
  await db.insert(smsTemplates).values(Object.entries(SMS_EVENTS).map(([event, v], i) => ({ event, title: v.title, body: v.body, variables: v.vars, patternId: String(100100 + i) })));

  const pw = hashPassword("Demo@1234");
  const mk = async (name: string, phone: string, role: string) => (await db.insert(users).values({ name, phone, role, passwordHash: pw, email: `${phone}@sabzineh.ir` }).returning())[0];
  const admin = await mk("مدیر کل سامانه", "09120000001", "super_admin");
  await mk("سارا کریمی", "09120000002", "marketplace_manager");
  const proc = await mk("حمید نوری", "09120000003", "procurement_manager");
  const wh = await mk("رضا صادقی", "09120000004", "warehouse_manager");
  await mk("نرگس فرهادی", "09120000005", "accountant");
  const sup = await mk("امیر حسینی", "09120000006", "support");
  await mk("لیلا مرادی", "09120000007", "catalog_manager");
  const c1 = await mk("علی رضایی", "09121111111", "customer");
  const c2 = await mk("مریم احمدی", "09122222222", "customer");

  const sellerDefs = [
    { name: "محمد پارسا", phone: "09123333331", shop: "مزرعه سبز کوهپایه", city: "تهران", status: "approved", rate: 8, rating: 4.9 },
    { name: "کامران تهرانی", phone: "09123333332", shop: "کندوی طلایی سبلان", city: "اردبیل", status: "approved", rate: 7, rating: 4.7 },
    { name: "جواد شرقی", phone: "09123333333", shop: "باغ‌های ارگانیک خراسان", city: "مشهد", status: "approved", rate: 9, rating: 4.5 },
    { name: "بهرام نوروزی", phone: "09123333334", shop: "کشت‌وکار پاک زاینده‌رود", city: "اصفهان", status: "pending", rate: 8, rating: 0 },
  ];
  const sellerRows: (typeof sellers.$inferSelect)[] = [];
  for (const d of sellerDefs) {
    const u = await mk(d.name, d.phone, "seller");
    const [s] = await db.insert(sellers).values({
      userId: u.id, shopName: d.shop, city: d.city, status: d.status, contractStatus: d.status === "approved" ? "signed" : "pending",
      commissionRate: d.rate, rating: d.rating, iban: "IR820540102680020817909002", nationalId: "0012345678", legalDocs: "جواز کسب، کارت بازرگانی",
    }).returning();
    await db.insert(wallets).values({ sellerId: s.id });
    sellerRows.push(s);
  }
  const [s1, s2, s3] = sellerRows;

  await postJournal(db, "سرمایه اولیه", [{ code: "1101", debit: 800_000_000 }, { code: "3101", credit: 800_000_000 }], undefined, admin.id);

  const cats = ["عسل و فرآورده‌های زنبور", "ادویه و دمنوش", "خشکبار و مغزها", "روغن‌های طبیعی", "میوه و سبزی تازه", "لبنیات و تخم‌مرغ محلی"];
  const catRows = await db.insert(categories).values(cats.map((name, i) => ({ name, slug: `cat-${i + 1}` }))).returning();

  const img: Record<string, number | null> = {};
  for (const f of ["honey", "tea", "nuts", "oil", "veg"]) {
    const p = path.join(process.cwd(), "seed-assets", `${f}.jpg`);
    if (existsSync(p)) {
      const data = readFileSync(p);
      const [m] = await db.insert(media).values({ filename: `${f}.jpg`, mime: "image/jpeg", size: data.length, data, uploadedBy: admin.id }).returning();
      img[f] = m.id;
    } else img[f] = null;
  }

  type P = { fa: string; en: string; sku: string; pn: string; oem: string; x: string[]; brand: string; country: string; cat: number; auth: string; price: number; cmp: number; img: string; src: "central" | "marketplace"; stock: number; cost: number; compat: [string, string, string][]; specs: [string, string][] };
  const defs: P[] = [
    { fa: "عسل طبیعی آویشن کوهستان", en: "Organic Thyme Mountain Honey", sku: "HNY-THY-1K", pn: "HN-1001", oem: "ORG-IR-2231", x: ["عسل آویشن", "Thyme Honey"], brand: "کندوی طلایی", country: "ایران (سبلان)", cat: 0, auth: "Original", price: 1450000, cmp: 1650000, img: "honey", src: "central", stock: 40, cost: 1050000, compat: [["ارگانیک گواهی‌شده", "مؤسسه استاندارد ایران", "۱۴۰۶"], ["بدون قند افزوده", "آزمایشگاه همکار", "دائمی"], ["گیاهخواری", "—", ""]], specs: [["وزن خالص", "۱ کیلوگرم"], ["درصد ساکارز", "کمتر از ۳٪"], ["نوع بسته‌بندی", "شیشه‌ای"], ["ماندگاری", "۲۴ ماه"]] },
    { fa: "زعفران سرگل ممتاز قائنات", en: "Premium Saffron Sargol Qaenat", sku: "SPC-SAF-4G", pn: "SF-2040", oem: "ORG-IR-5510", x: ["Saffron", "زعفران نگین"], brand: "زعفران قائن", country: "ایران (خراسان جنوبی)", cat: 1, auth: "Original", price: 6800000, cmp: 7200000, img: "tea", src: "marketplace", stock: 0, cost: 0, compat: [["ارگانیک گواهی‌شده", "اتحادیه اروپا (EU Organic)", "۲۰۲۷"], ["بدون گلوتن", "—", ""]], specs: [["وزن", "۴ مثقال (۱۸.۴ گرم)"], ["رنگ‌دهی (کروسین)", "بالای ۲۴۰"], ["برداشت", "۱۴۰۴"]] },
    { fa: "مغز گردو ارگانیک تویسرکان", en: "Organic Walnut Kernels", sku: "NUT-WAL-500", pn: "NT-3005", oem: "NAT-IR-1120", x: ["گردو", "Walnut"], brand: "باغستان", country: "ایران (همدان)", cat: 2, auth: "Aftermarket", price: 685000, cmp: 760000, img: "nuts", src: "central", stock: 120, cost: 480000, compat: [["وگان", "—", ""], ["کتوژنیک", "—", ""]], specs: [["وزن", "۵۰۰ گرم"], ["رنگ مغز", "روشن درجه یک"], ["بسته‌بندی", "زیپ‌کیپ کرافت"]] },
    { fa: "روغن کنجد پرس سرد", en: "Cold-Pressed Sesame Oil", sku: "OIL-SES-1L", pn: "OL-4012", oem: "NAT-IR-7781", x: ["Sesame Oil", "روغن ارده"], brand: "روغن‌کده سنتی", country: "ایران", cat: 3, auth: "OEM", price: 520000, cmp: 0, img: "oil", src: "marketplace", stock: 0, cost: 0, compat: [["وگان", "—", ""], ["بدون نگهدارنده", "—", ""]], specs: [["حجم", "۱ لیتر"], ["روش استخراج", "پرس سرد سنگی"]] },
    { fa: "روغن زیتون فرابکر ارگانیک رودبار", en: "Organic Extra Virgin Olive Oil", sku: "OIL-OLV-EV", pn: "OL-4001", oem: "ORG-IR-3302", x: ["Olive Oil", "EVOO"], brand: "زیتون طلایی رودبار", country: "ایران (گیلان)", cat: 3, auth: "Original", price: 690000, cmp: 780000, img: "oil", src: "central", stock: 60, cost: 480000, compat: [["ارگانیک گواهی‌شده", "مؤسسه استاندارد ایران", "۱۴۰۶"], ["وگان", "—", ""], ["رژیم مدیترانه‌ای", "—", ""]], specs: [["اسیدیته", "کمتر از ۰.۸٪"], ["روش استخراج", "پرس سرد"], ["بطری", "شیشه تیره"]] },
    { fa: "دمنوش ارگانیک بابونه و نعناع", en: "Organic Chamomile & Mint Tea", sku: "TEA-CHM-100", pn: "TE-5003", oem: "ORG-IR-4410", x: ["Chamomile", "دمنوش آرامش"], brand: "گیاه‌بان", country: "ایران", cat: 1, auth: "OEM", price: 420000, cmp: 0, img: "tea", src: "marketplace", stock: 0, cost: 0, compat: [["بدون کافئین", "—", ""], ["وگان", "—", ""]], specs: [["وزن", "۱۰۰ گرم"], ["ترکیب", "بابونه ۷۰٪، نعناع ۳۰٪"]] },
    { fa: "سبد سبزیجات تازه ارگانیک هفتگی", en: "Weekly Organic Vegetable Box", sku: "VEG-BOX-5K", pn: "VG-6001", oem: "ORG-IR-9001", x: ["سبد سلامت", "Veggie Box"], brand: "مزرعه سبز کوهپایه", country: "ایران (دماوند)", cat: 4, auth: "Original", price: 2350000, cmp: 2600000, img: "veg", src: "central", stock: 18, cost: 1700000, compat: [["ارگانیک گواهی‌شده", "جهاد کشاورزی", "۱۴۰۵"], ["بدون سم و کود شیمیایی", "آزمایشگاه همکار", "هر فصل"]], specs: [["وزن تقریبی", "۵ کیلوگرم"], ["اقلام", "گوجه، خیار، کاهو، هویج، سبزی خوردن"], ["زمان برداشت", "۲۴ ساعت قبل از ارسال"]] },
    { fa: "خرمای مضافتی ارگانیک بم", en: "Organic Mazafati Dates", sku: "DRY-DAT-1K", pn: "DT-7002", oem: "NAT-IR-6620", x: ["Mazafati", "رطب"], brand: "نخلستان بم", country: "ایران (کرمان)", cat: 2, auth: "OEM", price: 490000, cmp: 530000, img: "nuts", src: "marketplace", stock: 0, cost: 0, compat: [["وگان", "—", ""], ["بدون قند افزوده", "—", ""]], specs: [["وزن", "۱ کیلوگرم"], ["درجه", "صادراتی"]] },
    { fa: "گوجه‌فرنگی گیلاسی ارگانیک", en: "Organic Cherry Tomatoes", sku: "VEG-TOM-1K", pn: "VG-6010", oem: "ORG-IR-9010", x: ["Cherry Tomato"], brand: "مزرعه سبز کوهپایه", country: "ایران", cat: 4, auth: "Original", price: 198000, cmp: 0, img: "veg", src: "central", stock: 2, cost: 145000, compat: [["ارگانیک گواهی‌شده", "جهاد کشاورزی", "۱۴۰۵"]], specs: [["وزن", "۱ کیلوگرم"], ["نوع کشت", "گلخانه ارگانیک"]] },
    { fa: "عسل موم‌دار چهل‌گیاه", en: "Multiflora Honeycomb", sku: "HNY-CMB-1K", pn: "HN-1010", oem: "NAT-IR-2240", x: ["Honeycomb", "عسل با موم"], brand: "کندوی طلایی", country: "ایران", cat: 0, auth: "Aftermarket", price: 1240000, cmp: 0, img: "honey", src: "central", stock: 0, cost: 900000, compat: [["طبیعی و خام", "—", ""]], specs: [["وزن", "۱ کیلوگرم"], ["نوع", "موم‌دار قاب کامل"]] },
  ];

  const pids: number[] = [];
  const ctx = { userId: admin.id, ip: "seed", ua: "seed" };
  for (const d of defs) {
    const [p] = await db.insert(products).values({
      nameFa: d.fa, nameEn: d.en, sku: d.sku, partNumber: d.pn, normalizedPn: normalizePn(d.pn), oemNumber: d.oem, crossRefs: d.x, brand: d.brand,
      manufacturer: d.brand, country: d.country, categoryId: catRows[d.cat].id, authenticity: d.auth, basePrice: d.price, compareAtPrice: d.cmp,
      shortDesc: `${d.fa}؛ ${d.compat.map((c) => c[0]).join("، ")} — مستقیم از تولیدکننده، تازه و با کیفیت تضمین‌شده`,
      description: `${d.fa} محصول ${d.country} و برند ${d.brand} است که مستقیماً از تولیدکننده تهیه شده و پیش از ارسال، کنترل کیفیت و آزمون آزمایشگاهی شده است. بدون مواد نگهدارنده، رنگ و طعم‌دهنده مصنوعی. در جای خشک و خنک و دور از نور مستقیم نگهداری شود.`,
      technicalReview: `در بررسی کارشناسان تغذیه سبزینه، ${d.fa} از نظر خلوص، ارزش غذایی و روش تولید مطابق استانداردهای ارگانیک است. نمونه این محصول برای بقایای سموم، فلزات سنگین و تقلب آزمایش شده و نتایج در محدوده مجاز بوده است. مصرف روزانه آن در کنار رژیم متعادل توصیه می‌شود.`,
      specs: d.specs.map(([k, v]) => ({ k, v })), compatibility: d.compat.map(([make, model, years]) => ({ make, model, years })), organicInfo: { ...(ORGANIC_SAMPLES[d.sku] ?? {}), suitableFor: d.compat.map((c) => c[0]).filter((t) => !/ارگانیک|خام/.test(t)) },
      weight: 1000, barcode: `626${Math.floor(Math.random() * 1e10)}`, seoTitle: `خرید ${d.fa} | سبزینه`, metaDesc: `خرید آنلاین ${d.fa} ارگانیک با ضمانت اصالت و ارسال سریع`,
      slug: d.en.toLowerCase().replace(/[^a-z0-9]+/g, "-"), mainImageId: img[d.img], source: d.src, createdBy: admin.id,
      ownerSellerId: d.src === "marketplace" ? s1.id : null, status: "active", lowStockThreshold: 3,
    }).returning();
    if (img[d.img]) await db.insert(productImages).values({ productId: p.id, mediaId: img[d.img]!, sortOrder: 0 });
    if (d.src === "central" && d.stock > 0) await svcCatalog.receiveStock(ctx, p.id, d.stock, d.cost, 2_000_000, d.auth === "Original" ? 1_500_000 : 0, "موجودی اولیه");
    pids.push(p.id);
  }
  // Multi-parameter variants for olive oil (volume × grade)
  const vol = "حجم", grade = "درجه";
  await db.insert(productVariants).values([
    { productId: pids[4], title: "۵۰۰ میلی‌لیتر / فرابکر", attrs: { [vol]: "۵۰۰ میلی‌لیتر", [grade]: "فرابکر" }, sku: "OIL-OLV-EV-05", price: 690000, onHand: 15 },
    { productId: pids[4], title: "۱ لیتر / فرابکر", attrs: { [vol]: "۱ لیتر", [grade]: "فرابکر" }, sku: "OIL-OLV-EV-10", price: 1290000, onHand: 10 },
    { productId: pids[4], title: "۵۰۰ میلی‌لیتر / بکر", attrs: { [vol]: "۵۰۰ میلی‌لیتر", [grade]: "بکر" }, sku: "OIL-OLV-V-05", price: 540000, onHand: 8 },
    { productId: pids[4], title: "۱ لیتر / بکر", attrs: { [vol]: "۱ لیتر", [grade]: "بکر" }, sku: "OIL-OLV-V-10", price: 980000, onHand: 4 },
  ]);
  await db.update(products).set({ onHand: sql`${products.onHand} + 37`, options: [{ name: vol, values: ["۵۰۰ میلی‌لیتر", "۱ لیتر"] }, { name: grade, values: ["فرابکر", "بکر"] }] }).where(eq(products.id, pids[4]));

  const offer = async (pi: number, s: typeof s1, price: number, stock: number, ship: number, prep: number, buy = false, status = "approved", sale: number | null = null) =>
    (await db.insert(sellerOffers).values({ productId: pids[pi], sellerId: s.id, price, costPrice: Math.round((sale ?? price) * 0.75), salePrice: sale, stock, shippingCost: ship, prepDays: prep, shipCity: s.city, warranty: "ضمانت تازگی و بازگشت وجه", status, isBuyBox: buy }).returning())[0];
  const o1 = await offer(0, s1, 1390000, 25, 60000, 1, true);
  await offer(0, s2, 1420000, 10, 45000, 2);
  const o3 = await offer(1, s1, 6750000, 8, 80000, 1, true);
  await offer(1, s3, 6490000, 4, 120000, 3);
  const o5 = await offer(2, s2, 175000, 60, 45000, 1);
  await offer(3, s1, 510000, 30, 60000, 1, true);
  await offer(3, s2, 495000, 12, 45000, 2, false, "approved", 480000);
  await offer(5, s1, 415000, 40, 60000, 1, true);
  await offer(5, s3, 399000, 25, 120000, 2);
  const o10 = await offer(7, s2, 4850000, 6, 90000, 2, true);
  await offer(7, s3, 4700000, 3, 120000, 4, false, "pending");
  await offer(9, s3, 230000, 20, 120000, 2, true);

  // A pending seller product awaiting approval
  await db.insert(products).values({
    nameFa: "گرده گل زنبور عسل", nameEn: "Bee Pollen", sku: "HNY-POL-250", partNumber: "HN-1020", normalizedPn: "HN1020", brand: "کندوی طلایی", country: "ایران (اردبیل)",
    categoryId: catRows[0].id, authenticity: "OEM", basePrice: 850000, slug: "bee-pollen", source: "marketplace", ownerSellerId: s2.id, status: "pending",
    shortDesc: "گرده گل خالص و خشک‌شده در سایه، منبع پروتئین و ویتامین", compatibility: [{ make: "طبیعی و خام", model: "—", years: "" }],
  });

  // Orders through real flows
  const addr = (u: typeof c1) => ({ fullName: u.name, phone: u.phone, city: "تهران", address: "تهران، خیابان ولیعصر، کوچه نسترن، پلاک ۸", postalCode: "1968913111" });
  const cctx = (u: typeof c1) => ({ userId: u.id, ip: "seed", ua: "seed" });
  const ord1 = await svcOrders.placeOrder(cctx(c1), [{ productId: pids[2], qty: 2 }, { productId: pids[0], offerId: o1.id, qty: 1 }, { productId: pids[7], offerId: o10.id, qty: 1 }], addr(c1), "seed-o1");
  await svcOrders.payOrder(cctx(c1), ord1.id, "seed-p1");
  const shs1 = await db.select().from(sellerShipments).where(eq(sellerShipments.orderId, ord1.id));
  for (const sh of shs1) {
    const scope = { sellerId: sh.sellerId, staff: true };
    const wctx = { userId: wh.id };
    await svcOrders.updateShipment(wctx, sh.id, { status: "preparing" }, scope);
    await svcOrders.updateShipment(wctx, sh.id, { status: "ready", packageCount: 1 }, scope);
    await svcOrders.updateShipment(wctx, sh.id, { status: "shipped", carrier: "پست پیشتاز", trackingNumber: `2${Math.floor(Math.random() * 1e11)}` }, scope);
  }
  await svcOrders.confirmReceipt(cctx(c1), ord1.id);

  const ord2 = await svcOrders.placeOrder(cctx(c2), [{ productId: pids[1], offerId: o3.id, qty: 1 }, { productId: pids[2], offerId: o5.id, qty: 3 }, { productId: pids[6], qty: 1 }], addr(c2), "seed-o2");
  await svcOrders.payOrder(cctx(c2), ord2.id, "seed-p2");
  const shs2 = await db.select().from(sellerShipments).where(eq(sellerShipments.orderId, ord2.id));
  const shS1 = shs2.find((s) => s.sellerId === s1.id)!;
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "preparing" }, { sellerId: s1.id, staff: false });
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "ready", packageCount: 1 }, { sellerId: s1.id, staff: false });
  await svcOrders.updateShipment({ userId: admin.id }, shS1.id, { status: "shipped", carrier: "تیپاکس", trackingNumber: "TPX-88213094" }, { sellerId: s1.id, staff: false });

  await svcOrders.placeOrder(cctx(c1), [{ productId: pids[4], qty: 2 }, { productId: pids[4], variantId: undefined, qty: 1 }], addr(c1), "seed-o3").catch(() => null);
  const ord4 = await svcOrders.placeOrder(cctx(c2), [{ productId: pids[8], qty: 1 }], addr(c2), "seed-o4");
  await svcOrders.cancelOrder(cctx(c2), ord4.id, { staff: false }, "انصراف مشتری");

  // Wallet withdrawal
  await svcWallet.requestWithdrawal({ userId: s1.userId }, s1.id, 500000, "IR820540102680020817909002", "seed-w1").catch(() => null);

  // Supply requests
  const mkReq = async (u: typeof c1, v: Partial<typeof supplyRequests.$inferInsert>, n: string) =>
    (await db.insert(supplyRequests).values({ customerId: u.id, number: n, ...v, normalizedPn: normalizePn(v.partNumber ?? "") }).returning())[0];
  await mkReq(c1, { method: "part_number", partNumber: "", partName: "ژل رویال تازه", carMake: "هر برند معتبر", carModel: "شیشه‌ای", carYear: "۵۰ گرم", qty: 2, priority: "high", description: "برای مصرف ورزشکار؛ تاریخ تولید جدید باشد" }, "RQ-1001");
  const r2 = await mkReq(c2, { method: "vin", partNumber: "", partName: "آرد جو دوسر بدون گلوتن", carMake: "وارداتی", carModel: "پاکت", carYear: "۱ کیلوگرم", vin: "5901234123457", qty: 3 }, "RQ-1002");
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "review" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "search" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r2.id, { action: "rfq" });
  const qs = await db.select().from(supplyQuotes).where(eq(supplyQuotes.requestId, r2.id));
  await svcSupply.sellerQuote({ userId: s1.userId }, s1.id, qs[0].id, { price: 7400000, stock: 2, leadDays: 3, brand: "برند اروپایی", note: "دارای گواهی بدون گلوتن" });
  const r3 = await mkReq(c1, { method: "part_number", partNumber: "OL-4001", partName: "روغن زیتون ارگانیک", carMake: "زیتون طلایی رودبار", carModel: "بطری", carYear: "۱ لیتر", qty: 4 }, "RQ-1003");
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "review" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "search" });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "calculate", margin: 15 });
  await svcSupply.staffSupplyAction({ userId: proc.id }, r3.id, { action: "send_quotation" });

  // Tickets
  const [t1] = await db.insert(tickets).values({ number: "TK-5001", customerId: c1.id, subject: "زمان ارسال سفارش", department: "orders", priority: "normal", status: "pending_staff", orderId: ord1.id }).returning();
  await db.insert(ticketMessages).values([
    { ticketId: t1.id, userId: c1.id, body: "سلام، سفارش من چه زمانی ارسال می‌شود؟" },
    { ticketId: t1.id, userId: sup.id, body: "مشتری پیگیر است؛ با انبار هماهنگ شود.", isInternal: true },
  ]);
  await db.insert(tickets).values({ number: "TK-5002", customerId: c2.id, subject: "گواهی ارگانیک زعفران", department: "technical", priority: "high", status: "open" });
}

/** Idempotent upgrades for data added in later versions. Safe to run on every boot. */
export async function ensureExtras() {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(99124)");
    const deps = await db.select().from(ticketDepartments);
    if (!deps.length) {
      await db.insert(ticketDepartments).values([
        { key: "support", name: "پشتیبانی عمومی", sortOrder: 1 }, { key: "orders", name: "سفارش‌ها و ارسال", sortOrder: 2 },
        { key: "technical", name: "مشاوره تغذیه و محصولات", sortOrder: 3 }, { key: "finance", name: "مالی و پرداخت", sortOrder: 4 },
        { key: "sellers", name: "امور فروشندگان", sortOrder: 5 },
      ]);
    }
    let det = await db.select().from(detailAccounts);
    if (!det.length) {
      const [p] = await db.insert(detailAccounts).values({ code: "1", name: "اشخاص", level: 1 }).returning();
      await db.insert(detailAccounts).values([{ code: "2", name: "مراکز هزینه", level: 1 }, { code: "3", name: "پروژه‌ها", level: 1 }]);
      const [cc] = await db.select().from(detailAccounts).where(eq(detailAccounts.code, "2"));
      await db.insert(detailAccounts).values([
        { code: "S", name: "فروشندگان مارکت‌پلیس", level: 2, parentId: p.id }, { code: "C", name: "مشتریان", level: 2, parentId: p.id },
        { code: "V", name: "تأمین‌کنندگان انبار مرکزی", level: 2, parentId: p.id },
        { code: "201", name: "انبار مرکزی", level: 2, parentId: cc.id }, { code: "202", name: "واحد فروش", level: 2, parentId: cc.id },
      ]);
      det = await db.select().from(detailAccounts);
    }
    const sParent = det.find((d) => d.code === "S");
    const allSellers = await db.select().from(sellers);
    for (const sl of allSellers) {
      if (!det.some((d) => d.code === `S-${sl.id}`)) await db.insert(detailAccounts).values({ code: `S-${sl.id}`, name: sl.shopName, level: 3, parentId: sParent?.id ?? null });
    }
    await db.execute(sql`update journal_lines l set detail1_id = d.id from detail_accounts d where l.detail1_id is null and l.detail1 like 'seller:%' and d.code = 'S-' || substring(l.detail1 from 8)`);
    // SMS: an extra alternative pattern for shipping (multiple templates per event)
    const extra = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "order_shipped"));
    if (extra.length === 1) {
      await db.update(smsTemplates).set({ isSystem: true }).where(sql`true`);
      await db.insert(smsTemplates).values({ event: "order_shipped", title: "ارسال سفارش - همراه لینک رهگیری", body: "مشتری گرامی، مرسوله سفارش {order} تحویل پست شد. رهگیری: https://tracking.post.ir/?id={tracking}", variables: ["order", "tracking"], isActive: false, patternId: "200201" });
    }
    // Variants: convert legacy single-title variants into multi-attribute options
    const [spark] = await db.select().from(products).where(eq(products.sku, "__legacy_none__"));
    if (spark && spark.options.length === 0) {
      const vs = await db.select().from(productVariants).where(eq(productVariants.productId, spark.id));
      const a = "تعداد در بسته", b = "گرید";
      for (const v of vs) {
        const pack = v.title.includes("۶") ? "۶ عددی" : "۴ عددی";
        await db.update(productVariants).set({ attrs: { [a]: pack, [b]: "استاندارد" }, title: `${pack} / استاندارد` }).where(eq(productVariants.id, v.id));
      }
      await db.insert(productVariants).values([
        { productId: spark.id, title: "۴ عددی / لیزری", attrs: { [a]: "۴ عددی", [b]: "لیزری" }, sku: "SPK-NGK-IR-4L", price: 3100000, onHand: 8 },
        { productId: spark.id, title: "۶ عددی / لیزری", attrs: { [a]: "۶ عددی", [b]: "لیزری" }, sku: "SPK-NGK-IR-6L", price: 4550000, onHand: 4 },
      ]);
      await db.update(products).set({ options: [{ name: a, values: ["۴ عددی", "۶ عددی"] }, { name: b, values: ["استاندارد", "لیزری"] }] }).where(eq(products.id, spark.id));
    }
    await ensureMarketing();
    await ensureCommunity();
    const [birthdayTpl] = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "birthday"));
    if (!birthdayTpl) await db.insert(smsTemplates).values({ event: "birthday", title: SMS_EVENTS.birthday.title, body: SMS_EVENTS.birthday.body, variables: ["name"], patternId: "", isActive: true, isSystem: true });
    const [otpTpl] = await db.select().from(smsTemplates).where(eq(smsTemplates.event, "otp_login"));
    if (!otpTpl) await db.insert(smsTemplates).values({ event: "otp_login", title: "کد ورود یک‌بارمصرف (OTP)", body: SMS_EVENTS.otp_login.body, variables: ["code"], patternId: "100099", isSystem: true });
  } finally {
    await client.query("select pg_advisory_unlock(99124)");
    client.release();
  }
}

async function ensureMarketing() {
  const [acc] = await db.select().from(accounts).where(eq(accounts.code, "5301"));
  if (!acc) {
    const [grp] = await db.select().from(accounts).where(eq(accounts.code, "5"));
    await db.insert(accounts).values({ code: "5301", name: "هزینه تخفیفات و جشنواره‌ها", level: "subsidiary", type: "expense", parentId: grp?.id ?? null });
  }
  const cs = await db.select().from(carriers);
  if (!cs.length) {
    const [post] = await db.insert(carriers).values({ name: "پست پیشتاز", code: "post", trackingUrl: "https://tracking.post.ir/?id={code}", baseCost: 65000, perKgCost: 18000, freeThreshold: 5000000, minDays: 2, maxDays: 5, sortOrder: 1 }).returning();
    const [tpx] = await db.insert(carriers).values({ name: "تیپاکس", code: "tipax", trackingUrl: "https://tipaxco.com/tracking?code={code}", baseCost: 95000, perKgCost: 25000, minDays: 1, maxDays: 3, sortOrder: 2 }).returning();
    await db.insert(carriers).values({ name: "چاپار", code: "chapar", trackingUrl: "https://chaparnet.com/track/{code}", baseCost: 85000, perKgCost: 22000, minDays: 1, maxDays: 4, sortOrder: 3 });
    const [peyk] = await db.insert(carriers).values({ name: "پیک موتوری (فقط تهران)", code: "peyk", baseCost: 999000, perKgCost: 0, minDays: 0, maxDays: 1, sortOrder: 4 }).returning();
    await db.insert(carrierRates).values([
      { carrierId: post.id, city: "تهران", minWeight: 0, maxWeight: 2000, cost: 55000 }, { carrierId: post.id, city: "تهران", minWeight: 2001, maxWeight: 10000, cost: 90000 },
      { carrierId: post.id, city: null, minWeight: 0, maxWeight: 2000, cost: 75000 }, { carrierId: post.id, city: null, minWeight: 2001, maxWeight: 10000, cost: 130000 },
      { carrierId: tpx.id, city: "تهران", minWeight: 0, maxWeight: 5000, cost: 80000 }, { carrierId: tpx.id, city: "مشهد", minWeight: 0, maxWeight: 5000, cost: 140000 },
      { carrierId: peyk.id, city: "تهران", minWeight: 0, maxWeight: 20000, cost: 120000 },
    ]);
  }
  const ds = await db.select().from(discountCodes);
  if (!ds.length) {
    const [ali] = await db.select().from(users).where(eq(users.phone, "09121111111"));
    const cats = await db.select().from(categories);
    const brake = cats.find((c) => c.name === "عسل و فرآورده‌های زنبور");
    const [spark] = await db.select().from(products).where(eq(products.sku, "OIL-OLV-EV"));
    const in30 = new Date(Date.now() + 30 * 864e5);
    await db.insert(discountCodes).values([
      { code: "WELCOME10", title: "۱۰٪ خوش‌آمدگویی", type: "percent", value: 10, maxDiscount: 300000, minOrder: 500000, perUserLimit: 1, endsAt: in30 },
      { code: "ALI-VIP", title: "هدیه ویژه آقای رضایی", type: "fixed", value: 200000, customerId: ali?.id ?? null, perUserLimit: 3, usageLimit: 3 },
      { code: "HONEY15", title: "۱۵٪ تخفیف عسل و فرآورده‌های زنبور", type: "percent", value: 15, categoryIds: brake ? [brake.id] : [], perUserLimit: 2 },
      { code: "OLIVE50", title: "۵۰ هزار تومان تخفیف روغن زیتون", type: "fixed", value: 50000, productIds: spark ? [spark.id] : [], perUserLimit: 1 },
    ]);
  }
  const fs = await db.select().from(festivals);
  if (!fs.length) {
    const cats = await db.select().from(categories);
    const ids = cats.filter((c) => ["روغن‌های طبیعی", "ادویه و دمنوش"].includes(c.name)).map((c) => c.id);
    await db.insert(festivals).values({ title: "جشنواره پاییزه سلامت", slug: "autumn-health", description: "تخفیف ویژه روغن‌های طبیعی، ادویه و دمنوش‌های ارگانیک", color: "#c2410c", discountPercent: 12, startsAt: new Date(Date.now() - 864e5), endsAt: new Date(Date.now() + 12 * 864e5), categoryIds: ids });
  }
}

const ORGANIC_SAMPLES: Record<string, { origin: string; harvest: string; method: string; certificate?: string; labTest: string; storage: string; shelfLife: string; ingredients: string }> = {
  "HNY-THY-1K": { origin: "دامنه‌های سبلان، اردبیل (ارتفاع ۲۴۰۰ متر)", harvest: "تابستان ۱۴۰۴", method: "کندوی سنتی، بدون تغذیه شکر و آنتی‌بیوتیک", certificate: "گواهی ارگانیک مؤسسه استاندارد — ORG-IR-2231", labTest: "ساکارز ۲.۱٪، HMF زیر ۱۵، بدون باقی‌مانده سم", storage: "دمای اتاق، دور از نور و رطوبت", shelfLife: "۲۴ ماه", ingredients: "۱۰۰٪ عسل خالص آویشن" },
  "SPC-SAF-4G": { origin: "قائنات، خراسان جنوبی", harvest: "آبان ۱۴۰۴", method: "برداشت دستی و خشک‌کردن سنتی", certificate: "EU Organic — ORG-IR-5510", labTest: "کروسین ۲۴۵، پیکروکروسین ۹۵، سافرانال ۳۸", storage: "ظرف دربسته، دور از نور", shelfLife: "۳۶ ماه", ingredients: "کلاله زعفران سرگل" },
  "NUT-WAL-500": { origin: "تویسرکان، همدان", harvest: "مهر ۱۴۰۴", method: "باغ دیم بدون سمپاشی، مغزگیری دستی", labTest: "رطوبت ۴٪، بدون آفلاتوکسین", storage: "یخچال یا جای خنک و خشک", shelfLife: "۹ ماه", ingredients: "مغز گردو" },
  "OIL-SES-1L": { origin: "دزفول، خوزستان", harvest: "۱۴۰۴", method: "پرس سرد با آسیاب سنگی", labTest: "اسیدیته ۰.۶٪", storage: "دور از نور و حرارت", shelfLife: "۱۲ ماه", ingredients: "۱۰۰٪ کنجد" },
  "OIL-OLV-EV": { origin: "رودبار، گیلان", harvest: "آذر ۱۴۰۴", method: "پرس سرد زیر ۲۷ درجه در ۶ ساعت پس از برداشت", certificate: "گواهی ارگانیک — ORG-IR-3302", labTest: "اسیدیته ۰.۴٪، پراکسید ۶", storage: "بطری شیشه‌ای تیره، دمای ۱۵ تا ۲۰ درجه", shelfLife: "۱۸ ماه", ingredients: "۱۰۰٪ زیتون رقم زرد و روغنی" },
  "TEA-CHM-100": { origin: "دامنه‌های زاگرس", harvest: "بهار ۱۴۰۴", method: "خشک‌کردن در سایه", labTest: "بدون باقی‌مانده سم", storage: "ظرف دربسته", shelfLife: "۱۸ ماه", ingredients: "بابونه ۷۰٪، نعناع ۳۰٪" },
  "VEG-BOX-5K": { origin: "مزرعه ارگانیک دماوند", harvest: "۲۴ ساعت قبل از ارسال", method: "کشت ارگانیک با کود دامی و آبیاری قطره‌ای", certificate: "جهاد کشاورزی — ORG-IR-9001", labTest: "آزمون فصلی نیترات و سموم", storage: "یخچال", shelfLife: "۵ تا ۷ روز", ingredients: "سبزیجات فصل" },
  "DRY-DAT-1K": { origin: "بم، کرمان", harvest: "شهریور ۱۴۰۴", method: "نخلستان سنتی، بدون شربت‌زنی", labTest: "بدون قند افزوده", storage: "یخچال", shelfLife: "۱۲ ماه", ingredients: "خرمای مضافتی" },
  "VEG-TOM-1K": { origin: "دماوند", harvest: "روز ارسال", method: "گلخانه ارگانیک", certificate: "جهاد کشاورزی — ORG-IR-9010", labTest: "بدون باقی‌مانده سم", storage: "دمای اتاق", shelfLife: "۵ روز", ingredients: "گوجه گیلاسی" },
  "HNY-CMB-1K": { origin: "کوهستان‌های اردبیل", harvest: "تابستان ۱۴۰۴", method: "قاب کامل موم‌دار، خام و فرآوری‌نشده", labTest: "بدون ساکارز افزوده", storage: "دمای اتاق", shelfLife: "۲۴ ماه", ingredients: "عسل چهل‌گیاه با موم" },
};

async function ensureCommunity() {
  const all = await db.select().from(products);
  for (const p of all) {
    if (p.organicInfo && Object.keys(p.organicInfo).length) continue;
    const sample = ORGANIC_SAMPLES[p.sku];
    const tags = Array.from(new Set(p.compatibility.map((c) => c.make).filter((t) => t && !/ارگانیک|خام/.test(t))));
    await db.update(products).set({ organicInfo: { ...(sample ?? { origin: p.country ?? "" }), suitableFor: tags } }).where(eq(products.id, p.id));
  }
  const [hasRev] = await db.select({ id: reviews.id }).from(reviews).limit(1);
  if (hasRev) return;
  const [ali] = await db.select().from(users).where(eq(users.phone, "09121111111"));
  const [maryam] = await db.select().from(users).where(eq(users.phone, "09122222222"));
  const [sup] = await db.select().from(users).where(eq(users.phone, "09120000006"));
  const bySku = (sku: string) => all.find((p) => p.sku === sku);
  const honey = bySku("HNY-THY-1K"), oil = bySku("OIL-OLV-EV"), walnut = bySku("NUT-WAL-500");
  if (!ali || !maryam || !honey || !oil) return;
  await db.insert(reviews).values([
    { productId: honey.id, userId: ali.id, rating: 5, title: "بهترین عسلی که خریدم", body: "عطر آویشن کاملاً مشخصه و شکرک نزده. بسته‌بندی شیشه‌ای و محکم بود و زودتر از موعد رسید.", pros: ["عطر و طعم طبیعی", "بسته‌بندی شیشه‌ای", "ارسال سریع"], cons: ["قیمت کمی بالا"], recommend: true, verifiedPurchase: true, status: "approved", helpful: 12, notHelpful: 1, adminReply: "ممنون از اعتماد شما؛ نوش جان 🌿" },
    { productId: honey.id, userId: maryam.id, rating: 4, title: "کیفیت خوب", body: "طعمش عالیه، فقط دوست داشتم سایز کوچک‌تر هم داشته باشه برای امتحان کردن.", pros: ["طعم عالی", "برگه آزمایش همراه محصول"], cons: ["نبود سایز کوچک"], recommend: true, verifiedPurchase: false, status: "approved", helpful: 5 },
    { productId: oil.id, userId: maryam.id, rating: 5, title: "روغن زیتون واقعی", body: "تلخی و تندی ملایم روغن فرابکر واقعی رو داره. برای سالاد عالیه.", pros: ["اسیدیته پایین", "بطری تیره"], cons: [], recommend: true, verifiedPurchase: true, status: "approved", helpful: 8 },
    ...(walnut ? [{ productId: walnut.id, userId: ali.id, rating: 3, title: "متوسط", body: "مغزها روشن بود ولی چندتاش شکسته بود.", pros: ["رنگ روشن"], cons: ["مغز شکسته"], recommend: null, verifiedPurchase: true, status: "pending" }] : []),
  ]);
  const [q1] = await db.insert(productQuestions).values({ productId: honey.id, userId: maryam.id, body: "آیا این عسل برای کودکان زیر یک سال مناسب است؟", status: "approved" }).returning();
  const [q2] = await db.insert(productQuestions).values({ productId: oil.id, userId: ali.id, body: "برای سرخ کردن هم می‌شه استفاده کرد؟", status: "approved" }).returning();
  await db.insert(productQuestions).values({ productId: honey.id, userId: ali.id, body: "برگه آزمایشگاه همراه بسته ارسال می‌شود؟", status: "pending" });
  await db.insert(productAnswers).values([
    { questionId: q1.id, userId: sup?.id ?? ali.id, body: "خیر؛ مصرف هر نوع عسل برای کودکان زیر یک سال توصیه نمی‌شود.", role: "staff", status: "approved" },
    { questionId: q2.id, userId: maryam.id, body: "من برای پخت ملایم استفاده می‌کنم ولی برای سرخ‌کردن با حرارت بالا مناسب نیست.", role: "customer", status: "approved" },
  ]);
}
