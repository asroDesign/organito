import {
  pgTable, serial, text, integer, bigint, boolean, timestamp, jsonb, index, uniqueIndex, real,
} from "drizzle-orm/pg-core";

const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  avatarMediaId: integer("avatar_media_id"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"),
  roleId: integer("role_id"),
  birthdate: timestamp("birthdate", { withTimezone: true }),
  nationalId: text("national_id"),
  companyName: text("company_name"),
  companyNationalId: text("company_national_id"),
  companyManager: text("company_manager"),
  bankInfo: jsonb("bank_info").$type<{ cardNumber?: string; iban?: string; accountHolder?: string; bankName?: string }>(),
  referralCode: text("referral_code"),
  referredById: integer("referred_by_id"),
  marketingPoints: integer("marketing_points").notNull().default(0),
  smsConsent: boolean("sms_consent").notNull().default(false),
  extraPermissions: jsonb("extra_permissions").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: created(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: created(),
});

export const sellers = pgTable("sellers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  shopName: text("shop_name").notNull(),
  city: text("city").notNull().default("تهران"),
  rating: real("rating").notNull().default(4.5),
  status: text("status").notNull().default("pending"),
  contractStatus: text("contract_status").notNull().default("pending"),
  commissionRate: integer("commission_rate").notNull().default(8),
  settlementDays: integer("settlement_days").notNull().default(7),
  legalDocs: text("legal_docs"),
  nationalId: text("national_id"),
  iban: text("iban"),
  entityType: text("entity_type").notNull().default("individual"),
  profile: jsonb("profile").$type<Record<string, string>>().notNull().default({}),
  kycStatus: text("kyc_status").notNull().default("incomplete"),
  restricted: boolean("restricted").notNull().default(false),
  restrictReason: text("restrict_reason"),
  createdAt: created(),
});

export const sellerDocuments = pgTable("seller_documents", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  mediaId: integer("media_id"),
  status: text("status").notNull().default("pending"),
  required: boolean("required").notNull().default(false),
  requestedBy: integer("requested_by"),
  requestNote: text("request_note"),
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [index("sd_seller").on(t.sellerId)]);

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().unique(),
  pendingBalance: money("pending_balance"),
  availableBalance: money("available_balance"),
  lockedBalance: money("locked_balance"),
  withdrawnBalance: money("withdrawn_balance"),
  updatedAt: updated(),
});

export const customerWallets = pgTable("customer_wallets", {
  userId: integer("user_id").primaryKey(),
  balance: money("balance"),
  updatedAt: updated(),
});
export const customerWalletEntries = pgTable("customer_wallet_entries", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), amount: bigint("amount", { mode: "number" }).notNull(),
  type: text("type").notNull(), description: text("description").notNull(), reference: text("reference").unique(), createdAt: created(),
}, (t) => [index("customer_wallet_entries_user_created").on(t.userId, t.createdAt)]);
export const customerAddresses = pgTable("customer_addresses", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), title: text("title").notNull().default("خانه"),
  receiverName: text("receiver_name").notNull(), receiverPhone: text("receiver_phone").notNull(), city: text("city").notNull(),
  address: text("address").notNull(), postalCode: text("postal_code"), latitude: text("latitude"), longitude: text("longitude"),
  isDefault: boolean("is_default").notNull().default(false), createdAt: created(), updatedAt: updated(),
}, (t) => [index("customer_addresses_user").on(t.userId, t.id)]);
export const customerFavorites = pgTable("customer_favorites", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), productId: integer("product_id").notNull(), createdAt: created(),
}, (t) => [uniqueIndex("customer_favorites_user_product").on(t.userId, t.productId), index("customer_favorites_user_created").on(t.userId, t.createdAt)]);
export const referralAwards = pgTable("referral_awards", {
  id: serial("id").primaryKey(), orderId: integer("order_id").notNull().unique(), referrerId: integer("referrer_id").notNull(),
  buyerId: integer("buyer_id").notNull(), points: integer("points").notNull(), createdAt: created(),
});
export const loyaltyPointEntries = pgTable("loyalty_point_entries", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), kind: text("kind").notNull(), points: integer("points").notNull(), amount: money("amount"), orderId: integer("order_id"), reference: text("reference").notNull().unique(), description: text("description").notNull(), createdAt: created(),
}, (t) => [index("loyalty_point_user_created").on(t.userId, t.createdAt), index("loyalty_point_kind_created").on(t.kind, t.createdAt)]);
export const customerWalletWithdrawals = pgTable("customer_wallet_withdrawals", {
  id: serial("id").primaryKey(), userId: integer("user_id").notNull(), amount: money("amount"), bankInfo: jsonb("bank_info").$type<Record<string, string>>().notNull(),
  status: text("status").notNull().default("pending"), note: text("note"), adminNote: text("admin_note"), createdAt: created(), processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => [index("customer_wallet_withdrawals_user").on(t.userId, t.createdAt)]);

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: text("type").notNull(),
  bucket: text("bucket").notNull(),
  amount: money("amount"),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  note: text("note"),
  createdAt: created(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
  description: text("description"),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  seoKeywords: text("seo_keywords"),
  canonicalUrl: text("canonical_url"),
  faqs: jsonb("faqs").$type<{ question: string; answer: string }[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImageId: integer("cover_image_id"),
  category: text("category").notNull().default("سلامت و سبک زندگی"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  seoTitle: text("seo_title"),
  metaDescription: text("meta_description"),
  canonicalUrl: text("canonical_url"),
  status: text("status").notNull().default("draft"),
  authorId: integer("author_id").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("blog_posts_status_published").on(t.status, t.publishedAt), index("blog_posts_category").on(t.category)]);

export const blogCategories = pgTable("blog_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("blog_categories_name_unique").on(t.name), index("blog_categories_order").on(t.sortOrder)]);

export const blogTags = pgTable("blog_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("blog_tags_name_unique").on(t.name)]);

export const mediaFolders = pgTable("media_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentId: integer("parent_id"),
  color: text("color"),
  legacyId: integer("legacy_id"),
  createdBy: integer("created_by"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("media_folders_parent").on(t.parentId), uniqueIndex("media_folders_legacy_unique").on(t.legacyId)]);

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  alt: text("alt"),
  folderId: integer("folder_id"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  externalUrl: text("external_url"),
  legacySource: text("legacy_source"),
  legacyId: integer("legacy_id"),
  uploadedBy: integer("uploaded_by"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("media_folder_created").on(t.folderId, t.createdAt), uniqueIndex("media_legacy_unique").on(t.legacySource, t.legacyId)]);

export type Spec = { k: string; v: string; group?: string; hidden?: boolean; order?: number };
export type PurchaseOption = { name: string; type: "text" | "select" | "checkbox" | "radio"; required: boolean; values: { label: string; price: number; priceType: "fixed" | "percent" }[] };
export type ProductFaq = { question: string; answer: string };
export type Compat = { make: string; model: string; years: string };
export type ProductOption = { name: string; values: string[] };
export type OrganicInfo = {
  origin?: string; region?: string; harvest?: string; method?: string; certificate?: string; labTest?: string;
  storage?: string; shelfLife?: string; ingredients?: string; suitableFor?: string[];
};

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  nameFa: text("name_fa").notNull(),
  nameEn: text("name_en"),
  sku: text("sku").notNull().unique(),
  partNumber: text("part_number").notNull(),
  normalizedPn: text("normalized_pn").notNull(),
  oemNumber: text("oem_number"),
  crossRefs: jsonb("cross_refs").$type<string[]>().notNull().default([]),
  brand: text("brand").notNull(),
  manufacturer: text("manufacturer"),
  country: text("country"),
  categoryId: integer("category_id"),
  authenticity: text("authenticity").notNull().default("Aftermarket"),
  basePrice: money("base_price"),
  compareAtPrice: money("compare_at_price"),
  shortDesc: text("short_desc"),
  description: text("description"),
  technicalReview: text("technical_review"),
  specs: jsonb("specs").$type<Spec[]>().notNull().default([]),
  compatibility: jsonb("compatibility").$type<Compat[]>().notNull().default([]),
  weight: integer("weight"),
  barcode: text("barcode"),
  seoTitle: text("seo_title"),
  metaDesc: text("meta_desc"),
  seoKeywords: jsonb("seo_keywords").$type<string[]>().notNull().default([]),
  seoImageId: integer("seo_image_id"),
  relatedProductIds: jsonb("related_product_ids").$type<number[]>().notNull().default([]),
  crossSellProductIds: jsonb("cross_sell_product_ids").$type<number[]>().notNull().default([]),
  purchaseOptions: jsonb("purchase_options").$type<PurchaseOption[]>().notNull().default([]),
  productFaqs: jsonb("product_faqs").$type<ProductFaq[]>().notNull().default([]),
  deliveryEstimateEnabled: boolean("delivery_estimate_enabled").notNull().default(false),
  deliveryMinDays: integer("delivery_min_days").notNull().default(2),
  deliveryMaxDays: integer("delivery_max_days").notNull().default(5),
  slug: text("slug").notNull().unique(),
  mainImageId: integer("main_image_id"),
  source: text("source").notNull().default("central"),
  ownerSellerId: integer("owner_seller_id"),
  createdBy: integer("created_by"),
  status: text("status").notNull().default("draft"),
  rejectReason: text("reject_reason"),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
  allowBackorder: boolean("allow_backorder").notNull().default(false),
  inventoryBaseUnit: text("inventory_base_unit").notNull().default("عدد"),
  options: jsonb("options").$type<ProductOption[]>().notNull().default([]),
  organicInfo: jsonb("organic_info").$type<OrganicInfo>().notNull().default({}),
  videoMediaId: integer("video_media_id"),
  avgCost: money("avg_cost"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("products_pn_idx").on(t.normalizedPn), index("products_status_idx").on(t.status)]);

export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  mediaId: integer("media_id").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productViewLogs = pgTable("product_view_logs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  ip: text("ip").notNull(),
  userAgent: text("user_agent"),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("product_view_logs_product_viewed").on(t.productId, t.viewedAt)]);

export const productViewPresence = pgTable("product_view_presence", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sessionId: text("session_id").notNull(),
  ip: text("ip").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("product_view_presence_product_session").on(t.productId, t.sessionId), index("product_view_presence_product_seen").on(t.productId, t.lastSeenAt)]);

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  title: text("title").notNull(),
  attrs: jsonb("attrs").$type<Record<string, string>>().notNull().default({}),
  sku: text("sku").notNull(),
  price: money("price"),
  costPrice: money("cost_price"),
  inventoryUnit: text("inventory_unit").notNull().default("عدد"),
  baseUnitAmount: integer("base_unit_amount").notNull().default(1),
  compareAtPrice: money("compare_at_price"),
  rewardPoints: integer("reward_points").notNull().default(0),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isSellable: boolean("is_sellable").notNull().default(true),
});

export const sellerOffers = pgTable("seller_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  price: money("price"),
  costPrice: money("cost_price"),
  salePrice: bigint("sale_price", { mode: "number" }),
  stock: integer("stock").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  shippingCost: money("shipping_cost"),
  prepDays: integer("prep_days").notNull().default(1),
  shipCity: text("ship_city"),
  warranty: text("warranty"),
  condition: text("condition").notNull().default("new"),
  status: text("status").notNull().default("pending"),
  isBuyBox: boolean("is_buy_box").notNull().default(false),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("offer_product_seller").on(t.productId, t.sellerId)]);

export const posTerminals = pgTable("pos_terminals", {
  id: serial("id").primaryKey(), sellerId: integer("seller_id"), name: text("name").notNull(), bankName: text("bank_name"), terminalCode: text("terminal_code"), enabled: boolean("enabled").notNull().default(true), createdAt: created(), updatedAt: updated(),
}, (t) => [index("pos_terminal_seller_enabled").on(t.sellerId, t.enabled)]);

export const centralPosSales = pgTable("central_pos_sales", {
  status: text("status").notNull().default("completed"),
  rewardCode: text("reward_code"),
  id: serial("id").primaryKey(), number: text("number").notNull().unique(), idempotencyKey: text("idempotency_key").notNull().unique(), terminalId: integer("terminal_id"), createdBy: integer("created_by").notNull(), customerName: text("customer_name").notNull(), customerPhone: text("customer_phone").notNull(), subtotal: money("subtotal"), discount: money("discount"), total: money("total"), paymentMethod: text("payment_method").notNull(), settlement: jsonb("settlement").$type<{ cash: number; card: number }>().notNull().default({ cash: 0, card: 0 }), createdAt: created(),
}, (t) => [index("central_pos_created").on(t.createdAt)]);

export const centralPosItems = pgTable("central_pos_items", {
  id: serial("id").primaryKey(), saleId: integer("sale_id").notNull(), variantId: integer("variant_id").notNull(), productId: integer("product_id").notNull(), title: text("title").notNull(), quantity: integer("quantity").notNull(), unitPrice: money("unit_price"), lineTotal: money("line_total"), unitCost: money("unit_cost"), createdAt: created(),
}, (t) => [index("central_pos_items_sale").on(t.saleId)]);

export const sellerPosSales = pgTable("seller_pos_sales", {
  status: text("status").notNull().default("completed"),
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  terminalId: integer("terminal_id"),
  sellerId: integer("seller_id").notNull(),
  createdBy: integer("created_by").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  subtotal: money("subtotal"),
  discount: money("discount"),
  total: money("total"),
  paymentMethod: text("payment_method").notNull(),
  settlement: jsonb("settlement").$type<{ cash: number; card: number }>().notNull().default({ cash: 0, card: 0 }),
  createdAt: created(),
}, (t) => [index("seller_pos_seller_created").on(t.sellerId, t.createdAt)]);

export const sellerPosItems = pgTable("seller_pos_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  offerId: integer("offer_id").notNull(),
  productId: integer("product_id").notNull(),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: money("unit_price"),
  unitCost: money("unit_cost"),
  lineTotal: money("line_total"),
  createdAt: created(),
}, (t) => [index("seller_pos_items_sale").on(t.saleId), index("seller_pos_items_seller").on(t.sellerId)]);

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  offerId: integer("offer_id"),
  type: text("type").notNull(),
  qty: integer("qty").notNull(),
  unitCost: money("unit_cost"),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  note: text("note"),
  userId: integer("user_id"),
  createdAt: created(),
});

export const inventoryRepackJobs = pgTable("inventory_repack_jobs", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sourceVariantId: integer("source_variant_id").notNull(),
  targetVariantId: integer("target_variant_id").notNull(),
  inputQty: integer("input_qty").notNull(),
  outputQty: integer("output_qty").notNull(),
  note: text("note"),
  userId: integer("user_id"),
  createdAt: created(),
}, (t) => [index("inventory_repack_product_created").on(t.productId, t.createdAt)]);

/** Producers/owners of centrally held stock; independent from marketplace sellers. */
export const inventoryParties = pgTable("inventory_parties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  nationalId: text("national_id"),
  address: text("address"),
  detailAccountId: integer("detail_account_id"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: created(),
});

/** One inventory receipt line, linked to its invoice and accounting entry. */
export const inventoryReceipts = pgTable("inventory_receipts", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  type: text("type").notNull().default("purchase"),
  partyId: integer("party_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  quantity: integer("quantity").notNull(),
  unitCost: money("unit_cost").notNull().default(0),
  freight: money("freight").notNull().default(0),
  customs: money("customs").notNull().default(0),
  total: money("total").notNull().default(0),
  invoiceNumber: text("invoice_number"),
  paymentLocation: text("payment_location"),
  paymentTrackingNumber: text("payment_tracking_number"),
  paidAmount: money("paid_amount").notNull().default(0),
  note: text("note"),
  journalEntryId: integer("journal_entry_id"),
  userId: integer("user_id"),
  createdAt: created(),
}, (t) => [index("inventory_receipts_party_created").on(t.partyId, t.createdAt)]);

/** Remaining consignment quantity by owner and exact product variant. */
export const inventoryConsignmentLots = pgTable("inventory_consignment_lots", {
  id: serial("id").primaryKey(),
  receiptId: integer("receipt_id").notNull(),
  partyId: integer("party_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  initialQty: integer("initial_qty").notNull(),
  remainingQty: integer("remaining_qty").notNull(),
  unitCost: money("unit_cost").notNull().default(0),
  createdAt: created(),
}, (t) => [index("inventory_consignments_variant_created").on(t.variantId, t.createdAt)]);

export const inventoryConsignmentUsages = pgTable("inventory_consignment_usages", {
  id: serial("id").primaryKey(),
  lotId: integer("lot_id").notNull(),
  receiptId: integer("receipt_id").notNull(),
  partyId: integer("party_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  quantity: integer("quantity").notNull(),
  unitCost: money("unit_cost").notNull().default(0),
  action: text("action").notNull(),
  refType: text("ref_type").notNull(),
  refId: integer("ref_id").notNull(),
  reversed: boolean("reversed").notNull().default(false),
  createdAt: created(),
}, (t) => [index("inventory_consignment_usage_ref").on(t.refType, t.refId), index("inventory_consignment_usage_lot").on(t.lotId)]);

export const inventorySupplierPayments = pgTable("inventory_supplier_payments", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").notNull(),
  amount: money("amount").notNull(),
  paymentLocation: text("payment_location").notNull(),
  trackingNumber: text("tracking_number"),
  note: text("note"),
  journalEntryId: integer("journal_entry_id"),
  userId: integer("user_id"),
  createdAt: created(),
}, (t) => [index("inventory_supplier_payments_party_created").on(t.partyId, t.createdAt)]);

export type Address = { fullName: string; phone: string; city: string; address: string; postalCode: string; latitude?: string; longitude?: string };

export const orders = pgTable("orders", {
  creditAmount: money("credit_amount"),
  giftCardId: integer("gift_card_id"),
  recoveryCartId: integer("recovery_cart_id"),
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  status: text("status").notNull().default("pending_payment"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  itemsSubtotal: money("items_subtotal"),
  sellerShippingTotal: money("seller_shipping_total"),
  centralShipping: money("central_shipping"),
  discount: money("discount"),
  tax: money("tax"),
  total: money("total"),
  address: jsonb("address").$type<Address>().notNull(),
  festivalDiscount: money("festival_discount"),
  codeDiscount: money("code_discount"),
  discountCodeId: integer("discount_code_id"),
  discountCode: text("discount_code"),
  carrierId: integer("carrier_id"),
  officialInvoiceType: text("official_invoice_type"),
  officialInvoiceDetails: jsonb("official_invoice_details").$type<Record<string, string> | null>(),
  idempotencyKey: text("idempotency_key").unique(),
  paymentEntryId: integer("payment_entry_id"),
  customerConfirmedAt: timestamp("customer_confirmed_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  productId: integer("product_id").notNull(),
  variantId: integer("variant_id"),
  offerId: integer("offer_id"),
  sellerId: integer("seller_id"),
  shipmentId: integer("shipment_id"),
  title: text("title").notNull(),
  unitPrice: money("unit_price"),
  qty: integer("qty").notNull(),
  lineTotal: money("line_total"),
  unitCost: money("unit_cost"),
});

export const sellerShipments = pgTable("seller_shipments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  sellerId: integer("seller_id"),
  itemsTotal: money("items_total"),
  shippingCost: money("shipping_cost"),
  commission: money("commission"),
  deductions: money("deductions"),
  carrier: text("carrier"),
  carrierId: integer("carrier_id"),
  weight: integer("weight").notNull().default(0),
  trackingNumber: text("tracking_number"),
  packageCount: integer("package_count").notNull().default(1),
  status: text("status").notNull().default("pending"),
  prepDays: integer("prep_days").notNull().default(1),
  preparedAt: timestamp("prepared_at", { withTimezone: true }),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  settled: boolean("settled").notNull().default(false),
  notes: text("notes"),
  createdAt: created(),
});

export const orderHistory = pgTable("order_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull(),
  status: text("status").notNull(),
  note: text("note"),
  userId: integer("user_id"),
  createdAt: created(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id"),
  supplyRequestId: integer("supply_request_id"),
  amount: money("amount"),
  method: text("method").notNull().default("gateway"),
  status: text("status").notNull().default("success"),
  refCode: text("ref_code"),
  gateway: text("gateway"),
  authority: text("authority"),
  cardMasked: text("card_masked"),
  payerName: text("payer_name"),
  bankName: text("bank_name"),
  trackingCode: text("tracking_code"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  receiptMediaId: integer("receipt_media_id"),
  note: text("note"),
  details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
  recordedBy: integer("recorded_by"),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: created(),
});

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull(),
  amount: money("amount"),
  iban: text("iban").notNull(),
  status: text("status").notNull().default("pending"),
  trackingCode: text("tracking_code"),
  reviewedBy: integer("reviewed_by"),
  note: text("note"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: created(),
  updatedAt: updated(),
});

export const supplyRequests = pgTable("supply_requests", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  method: text("method").notNull().default("part_number"),
  partNumber: text("part_number"),
  normalizedPn: text("normalized_pn"),
  partName: text("part_name"),
  carMake: text("car_make"),
  carModel: text("car_model"),
  carYear: text("car_year"),
  vin: text("vin"),
  qty: integer("qty").notNull().default(1),
  description: text("description"),
  mediaIds: jsonb("media_ids").$type<number[]>().notNull().default([]),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  assigneeId: integer("assignee_id"),
  matchedProductId: integer("matched_product_id"),
  selectedQuoteId: integer("selected_quote_id"),
  marginPercent: integer("margin_percent").notNull().default(15),
  unitSalePrice: money("unit_sale_price"),
  shippingCost: money("shipping_cost"),
  quotationTotal: money("quotation_total"),
  quotationExpiresAt: timestamp("quotation_expires_at", { withTimezone: true }),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  createdAt: created(),
  updatedAt: updated(),
});

export const supplyQuotes = pgTable("supply_quotes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  price: money("price"),
  stock: integer("stock").notNull().default(0),
  leadDays: integer("lead_days").notNull().default(0),
  brand: text("brand"),
  note: text("note"),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  status: text("status").notNull().default("requested"),
  createdAt: created(),
});

export const supplyHistory = pgTable("supply_history", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  userId: integer("user_id"),
  createdAt: created(),
});

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  level: text("level").notNull(),
  type: text("type").notNull(),
  parentId: integer("parent_id"),
});

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  description: text("description").notNull(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  status: text("status").notNull().default("posted"),
  reversalOf: integer("reversal_of"),
  entryDate: timestamp("entry_date", { withTimezone: true }).notNull().defaultNow(),
  createdBy: integer("created_by"),
  createdAt: created(),
});

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  accountId: integer("account_id").notNull(),
  debit: money("debit"),
  credit: money("credit"),
  detail1: text("detail1"),
  detail2: text("detail2"),
  detail3: text("detail3"),
  detail1Id: integer("detail1_id"),
  detail2Id: integer("detail2_id"),
  detail3Id: integer("detail3_id"),
  description: text("description"),
}, (t) => [index("jl_entry").on(t.entryId), index("jl_account").on(t.accountId)]);

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  subject: text("subject").notNull(),
  department: text("department").notNull().default("support"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  assigneeId: integer("assignee_id"),
  orderId: integer("order_id"),
  productId: integer("product_id"),
  paymentId: integer("payment_id"),
  createdAt: created(),
  updatedAt: updated(),
});

export const ticketMessages = pgTable("ticket_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  mediaId: integer("media_id"),
  createdAt: created(),
});

export const smsTemplates = pgTable("sms_templates", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  title: text("title").notNull(),
  patternId: text("pattern_id"),
  body: text("body").notNull(),
  variables: jsonb("variables").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
});

export const smsLogs = pgTable("sms_logs", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  phone: text("phone").notNull(),
  provider: text("provider").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull(),
  response: text("response"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: created(),
});

export const centralLoyaltyMembers = pgTable("central_loyalty_members", {
  id: serial("id").primaryKey(), name: text("name").notNull(), phone: text("phone").notNull().unique(), birthdate: timestamp("birthdate", { withTimezone: true }), smsConsent: boolean("sms_consent").notNull().default(false), visits: integer("visits").notNull().default(0), totalSpent: money("total_spent"), lastPurchaseAt: timestamp("last_purchase_at", { withTimezone: true }), createdAt: created(), updatedAt: updated(),
}, (t) => [index("central_loyalty_consent_birthday").on(t.smsConsent, t.birthdate), index("central_loyalty_updated").on(t.updatedAt)]);

export const centralBirthdaySms = pgTable("central_birthday_sms", {
  id: serial("id").primaryKey(), memberId: integer("member_id").notNull(), birthdayDate: text("birthday_date").notNull(), status: text("status").notNull(), sentAt: created(),
}, (t) => [uniqueIndex("central_birthday_sms_member_date").on(t.memberId, t.birthdayDate)]);

export const sellerLoyaltyClubs = pgTable("seller_loyalty_clubs", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().unique(),
  name: text("name").notNull(),
  rewardPercent: integer("reward_percent").notNull().default(10),
  rewardMinSubtotal: money("reward_min_subtotal").notNull().default(300000),
  rewardValidityDays: integer("reward_validity_days").notNull().default(60),
  createdAt: created(),
});

export const sellerLoyaltyMembers = pgTable("seller_loyalty_members", {
  id: serial("id").primaryKey(),
  clubId: integer("club_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  birthdate: timestamp("birthdate", { withTimezone: true }),
  smsConsent: boolean("sms_consent").notNull().default(false),
  visits: integer("visits").notNull().default(0),
  totalSpent: money("total_spent"),
  lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("seller_loyalty_member_phone").on(t.clubId, t.phone), index("seller_loyalty_member_club").on(t.clubId)]);

export const sellerLoyaltyRewards = pgTable("seller_loyalty_rewards", {
  id: serial("id").primaryKey(), sellerId: integer("seller_id").notNull(), clubId: integer("club_id").notNull(), memberPhone: text("member_phone").notNull(), code: text("code").notNull().unique(), saleId: integer("sale_id"), discountPercent: integer("discount_percent").notNull(), minSubtotal: money("min_subtotal").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), redeemedAt: timestamp("redeemed_at", { withTimezone: true }), createdAt: created(),
}, (t) => [index("seller_loyalty_reward_owner").on(t.sellerId, t.memberPhone, t.expiresAt)]);

export const sellerSmsSettings = pgTable("seller_sms_settings", {
  id: serial("id").primaryKey(),
  sellerId: integer("seller_id").notNull().unique(),
  provider: text("provider").notNull().default("simulate"),
  apiKey: text("api_key"),
  senderNumber: text("sender_number"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: updated(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: created(),
}, (t) => [index("audit_entity").on(t.entity, t.entityId)]);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  read: boolean("read").notNull().default(false),
  createdAt: created(),
});

export type SitePageBlockItem = {
  id?: string;
  colSpan?: number;
  kind?: "text" | "image" | "cta";
  title: string;
  body: string;
  mediaId?: number | null;
  caption?: string;
  buttonLabel?: string;
  href?: string;
};
export type SitePageBlock = {
  id?: string;
  name?: string;
  enabled?: boolean;
  anchor?: string;
  style?: {
    background?: string; color?: string; accent?: string;
    align?: "right" | "center" | "left";
    width?: "contained" | "full";
    padding?: number; paddingMobile?: number; marginBottom?: number;
    radius?: number; minHeight?: number; gap?: number;
    columns?: number; mobileColumns?: number;
    hideDesktop?: boolean; hideMobile?: boolean;
  };
  options?: {
    badge?: string; secondaryLabel?: string; secondaryHref?: string;
    showSearch?: boolean; showStats?: boolean;
    autoplay?: boolean; interval?: number;
    limit?: number; categoryId?: number; productIds?: number[];
  };
  type: "hero" | "text" | "features" | "image" | "cta" | "faq" | "grid" | "slider" | "store_section";
  sectionId?: string;
  title?: string;
  body?: string;
  mediaId?: number | null;
  caption?: string;
  buttonLabel?: string;
  href?: string;
  items?: SitePageBlockItem[];
};
export type HomeBuilderDocument = {
  title: string; metaTitle: string; metaDescription: string; blocks: SitePageBlock[];
};
export type HomeBuilderRevision = { id: string; at: string; userId: number; document: HomeBuilderDocument };
export const homeBuilderState = pgTable("home_builder_state", {
  id: integer("id").primaryKey(),
  draft: jsonb("draft").$type<HomeBuilderDocument>().notNull(),
  revisions: jsonb("revisions").$type<HomeBuilderRevision[]>().notNull().default([]),
  version: integer("version").notNull().default(1),
  updatedAt: updated(),
});
export const contentPages = pgTable("content_pages", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  template: text("template").notNull().default("nature"),
  summary: text("summary"),
  blocks: jsonb("blocks").$type<SitePageBlock[]>().notNull().default([]),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  status: text("status").notNull().default("draft"),
  createdBy: integer("created_by"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("content_pages_status").on(t.status)]);
export const footerLinks = pgTable("footer_links", {
  id: serial("id").primaryKey(),
  groupTitle: text("group_title").notNull().default("دسترسی سریع"),
  label: text("label").notNull(),
  href: text("href").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("footer_links_order").on(t.enabled, t.sortOrder)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  scope: text("scope").notNull(),
  response: jsonb("response"),
  createdAt: created(),
});

export const ticketDepartments = pgTable("ticket_departments", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const detailAccounts = pgTable("detail_accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  level: integer("level").notNull().default(1),
  parentId: integer("parent_id"),
  isActive: boolean("is_active").notNull().default(true),
});

export const carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  trackingUrl: text("tracking_url"),
  baseCost: money("base_cost"),
  perKgCost: money("per_kg_cost"),
  freeThreshold: money("free_threshold"),
  minDays: integer("min_days").notNull().default(1),
  maxDays: integer("max_days").notNull().default(3),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const carrierRates = pgTable("carrier_rates", {
  id: serial("id").primaryKey(),
  carrierId: integer("carrier_id").notNull(),
  city: text("city"),
  minWeight: integer("min_weight").notNull().default(0),
  maxWeight: integer("max_weight").notNull().default(1000000),
  cost: money("cost"),
});

export const discountCodes = pgTable("discount_codes", {
  targetPhone: text("target_phone"),
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  type: text("type").notNull().default("percent"),
  value: integer("value").notNull(),
  maxDiscount: money("max_discount"),
  minOrder: money("min_order"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  usageLimit: integer("usage_limit"),
  perUserLimit: integer("per_user_limit").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  customerId: integer("customer_id"),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  categoryIds: jsonb("category_ids").$type<number[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: created(),
});

export const discountUsages = pgTable("discount_usages", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull(),
  userId: integer("user_id").notNull(),
  orderId: integer("order_id").notNull(),
  amount: money("amount"),
  createdAt: created(),
});

export const incompleteCarts = pgTable("incomplete_carts", {
  id: serial("id").primaryKey(),
  cartKey: text("cart_key").notNull().unique(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default("مشتری"),
  phone: text("phone").notNull(),
  items: jsonb("items").$type<{ productId: number; variantId: number | null; offerId: number | null; qty: number; title?: string }[]>().notNull().default([]),
  reason: text("reason").notNull().default("سبد خرید تکمیل نشده"),
  status: text("status").notNull().default("open"),
  lastSmsType: text("last_sms_type"),
  lastSmsStatus: text("last_sms_status"),
  discountCodeId: integer("discount_code_id"),
  lastSmsAt: timestamp("last_sms_at", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index("incomplete_carts_status_updated").on(t.status, t.updatedAt), index("incomplete_carts_customer").on(t.customerId)]);

export const festivals = pgTable("festivals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#e11d48"),
  discountPercent: integer("discount_percent").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  productIds: jsonb("product_ids").$type<number[]>().notNull().default([]),
  categoryIds: jsonb("category_ids").$type<number[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: created(),
});

export type IssueItem = { title: string; sku: string; partNumber: string; qty: number };
export const warehouseIssues = pgTable("warehouse_issues", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  shipmentId: integer("shipment_id").notNull(),
  orderId: integer("order_id").notNull(),
  sellerId: integer("seller_id"),
  status: text("status").notNull().default("issued"),
  items: jsonb("items").$type<IssueItem[]>().notNull().default([]),
  packageCount: integer("package_count").notNull().default(1),
  carrier: text("carrier"),
  warehouseName: text("warehouse_name"),
  notes: text("notes"),
  issuedBy: integer("issued_by").notNull(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  receiverName: text("receiver_name"),
  receiverPhone: text("receiver_phone"),
  receiverNationalId: text("receiver_national_id"),
  receiverRole: text("receiver_role"),
  handedOverBy: integer("handed_over_by"),
  handedOverAt: timestamp("handed_over_at", { withTimezone: true }),
  cancelReason: text("cancel_reason"),
  createdAt: created(),
}, (t) => [index("wi_shipment").on(t.shipmentId)]);

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  pros: jsonb("pros").$type<string[]>().notNull().default([]),
  cons: jsonb("cons").$type<string[]>().notNull().default([]),
  mediaIds: jsonb("media_ids").$type<number[]>().notNull().default([]),
  recommend: boolean("recommend"),
  verifiedPurchase: boolean("verified_purchase").notNull().default(false),
  status: text("status").notNull().default("pending"),
  helpful: integer("helpful").notNull().default(0),
  notHelpful: integer("not_helpful").notNull().default(0),
  adminReply: text("admin_reply"),
  createdAt: created(),
}, (t) => [index("reviews_product").on(t.productId, t.status), uniqueIndex("reviews_user_product").on(t.userId, t.productId)]);

export const reviewVotes = pgTable("review_votes", {
  id: serial("id").primaryKey(),
  reviewId: integer("review_id").notNull(),
  userId: integer("user_id").notNull(),
  up: boolean("up").notNull(),
}, (t) => [uniqueIndex("review_vote_unique").on(t.reviewId, t.userId)]);

export const productQuestions = pgTable("product_questions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: created(),
}, (t) => [index("pq_product").on(t.productId, t.status)]);

export const productAnswers = pgTable("product_answers", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  role: text("role").notNull().default("customer"),
  status: text("status").notNull().default("pending"),
  helpful: integer("helpful").notNull().default(0),
  createdAt: created(),
}, (t) => [index("pa_question").on(t.questionId)]);

export const otpCodes = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  used: boolean("used").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  createdAt: created(),
}, (t) => [index("otp_phone").on(t.phone)]);


export const accessRoles = pgTable("access_roles", {
  id: serial("id").primaryKey(), name: text("name").notNull().unique(),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]), createdAt: created(),
});
export const customerGroups = pgTable("customer_groups", {
  id: serial("id").primaryKey(), sellerId: integer("seller_id"), name: text("name").notNull(), createdAt: created(),
});
export const customerGroupMembers = pgTable("customer_group_members", {
  id: serial("id").primaryKey(), groupId: integer("group_id").notNull().references(()=>customerGroups.id,{onDelete:"cascade"}), phone: text("phone").notNull(),
},t=>[uniqueIndex("customer_group_phone").on(t.groupId,t.phone)]);
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(), sellerId: integer("seller_id"), name: text("name").notNull(),
  type: text("type").notNull(), body: text("body").notNull(), groupId: integer("group_id").references(()=>customerGroups.id),
  status: text("status").notNull().default("active"), scheduleAt: timestamp("schedule_at",{withTimezone:true}), sendHour: integer("send_hour").notNull().default(9),
  rewardPercent: integer("reward_percent").notNull().default(0), minOrder: money("min_order"), validityDays: integer("validity_days").notNull().default(30),
  lastRunAt: timestamp("last_run_at",{withTimezone:true}), createdAt: created(),
});
export const campaignDeliveries = pgTable("campaign_deliveries", {
  id: serial("id").primaryKey(), campaignId: integer("campaign_id").notNull().references(()=>marketingCampaigns.id),
  phone: text("phone").notNull(), name: text("name").notNull(), eventKey: text("event_key").notNull(),
  status: text("status").notNull().default("pending"), body: text("body").notNull(), rewardCode: text("reward_code"),
  createdAt: created(), processedAt: timestamp("processed_at",{withTimezone:true}),
},t=>[uniqueIndex("campaign_delivery_event").on(t.campaignId,t.eventKey,t.phone),index("campaign_delivery_pending").on(t.status)]);
export const customerBalances = pgTable("customer_balances", {
  phone: text("phone").primaryKey(), balance: money("balance"), updatedAt: updated(),
});
export const customerCreditEntries = pgTable("customer_credit_entries", {
  id: serial("id").primaryKey(), phone: text("phone").notNull(), amount: bigint("amount",{mode:"number"}).notNull(),
  reference: text("reference").notNull().unique(), note: text("note").notNull(), createdAt: created(),
});
export const giftCards = pgTable("gift_cards", {
  id: serial("id").primaryKey(), code: text("code").notNull().unique(), amount: money("amount"), balance: money("balance"),
  buyerName: text("buyer_name").notNull(), buyerPhone: text("buyer_phone").notNull(), targetPhone: text("target_phone"), message: text("message"),
  paymentMethod: text("payment_method").notNull(), settlement: jsonb("settlement").$type<{cash:number;card:number}>().notNull(), terminalId: integer("terminal_id"),
  revoked: boolean("revoked").notNull().default(false), createdBy: integer("created_by").notNull(), idempotencyKey: text("idempotency_key").notNull().unique(), createdAt: created(),
});
export const giftCardEntries = pgTable("gift_card_entries", {
  id: serial("id").primaryKey(), cardId: integer("card_id").notNull().references(()=>giftCards.id), amount: bigint("amount",{mode:"number"}).notNull(),
  reference: text("reference").notNull().unique(), createdAt: created(),
});
export const returnRequests = pgTable("return_requests", {
  id: serial("id").primaryKey(), kind: text("kind").notNull(), saleId: integer("sale_id").notNull(), number: text("number").notNull(),
  customerPhone: text("customer_phone").notNull(), customerName: text("customer_name").notNull(), sellerId: integer("seller_id"),
  reason: text("reason").notNull(), status: text("status").notNull().default("pending"), amount: money("amount"),
  adminNote: text("admin_note"), refundReference: text("refund_reference"), createdBy: integer("created_by").notNull(), processedBy: integer("processed_by"),
  createdAt: created(), processedAt: timestamp("processed_at",{withTimezone:true}),
},t=>[uniqueIndex("return_sale_unique").on(t.kind,t.saleId)]);
