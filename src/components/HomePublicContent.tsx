import type { SitePageBlock } from "@/db/schema";
import type { HomeData } from "@/lib/home-data";
import { PageBlockFrame } from "./PageBlockFrame";
import { PublicSiteBlockContent } from "./PublicSiteBlockContent";
import { StoreSection } from "./HomeContent";

/** Public server-rendered home page; keeps database-backed shortcode rendering out of the browser preview bundle. */
export function HomePublicContent({ blocks, data }: { blocks: SitePageBlock[]; data: HomeData }) {
  const primary = blocks.findIndex(block => block.enabled !== false);
  return <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 pb-16">{blocks.map((block, index) => block.type === "store_section"
    ? <PageBlockFrame key={block.id || index} block={block}><StoreSection block={block} data={data} primary={index === primary}/></PageBlockFrame>
    : <PublicSiteBlockContent key={block.id || index} block={block} primary={index === primary}/>)}</main>;
}
