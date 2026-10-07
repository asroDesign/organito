import { revalidateTag } from "next/cache";

export const PUBLIC_CATALOG_TAG = "public-catalog-taxonomy";
export const PUBLIC_BLOG_TAG = "public-blog-content";
export const PUBLIC_BRANDS_TAG = "public-brands";
export const PUBLIC_SITE_PAGES_TAG = "public-site-pages";

/** Purges only public, non-transactional reads. Product prices and stock stay uncached. */
export function invalidatePublicCatalogCache() {
  revalidateTag(PUBLIC_CATALOG_TAG, { expire: 0 });
  revalidateTag(PUBLIC_BRANDS_TAG, { expire: 0 });
}

export function invalidatePublicContentCache() {
  revalidateTag(PUBLIC_BLOG_TAG, { expire: 0 });
  revalidateTag(PUBLIC_SITE_PAGES_TAG, { expire: 0 });
}

export function invalidatePublicBrandCache() {
  revalidateTag(PUBLIC_BRANDS_TAG, { expire: 0 });
}
