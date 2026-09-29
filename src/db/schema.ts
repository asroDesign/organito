import {
  pgTable, serial, text, integer, bigint, boolean, timestamp, jsonb, customType, index, uniqueIndex, real,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
const money = (name: string) => bigint(name, { mode: "number" }).notNull().default(0);
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("customer"),
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
  sortOrder: integer("sort_order").notNull().default(0),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  uploadedBy: integer("uploaded_by"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: created(),
});

export type Spec = { k: string; v: string };
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

export const productVariants = pgTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  title: text("title").notNull(),
  attrs: jsonb("attrs").$type<Record<string, string>>().notNull().default({}),
  sku: text("sku").notNull(),
  price: money("price"),
  onHand: integer("on_hand").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const sellerOffers = pgTable("seller_offers", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sellerId: integer("seller_id").notNull(),
  price: money("price"),
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

export type Address = { fullName: string; phone: string; city: string; address: string; postalCode: string };

export const orders = pgTable("orders", {
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
