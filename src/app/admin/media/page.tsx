import { asc, desc } from "drizzle-orm";
import { FileImage, Folder, HardDrive } from "lucide-react";
import MediaLibraryClient from "@/components/MediaLibraryClient";
import { FeatureIntro, PageHeader, Stat } from "@/components/ui";
import { db } from "@/db";
import { media, mediaFolders } from "@/db/schema";
import { requirePage } from "@/lib/auth";
import { faNum } from "@/lib/util";

export default async function MediaLibraryPage(){
 await requirePage({perm:"PRODUCTS_EDIT"});
 const [folders,files]=await Promise.all([
  db.select().from(mediaFolders).orderBy(asc(mediaFolders.parentId),asc(mediaFolders.name)),
  db.select({id:media.id,filename:media.filename,alt:media.alt,folderId:media.folderId,mime:media.mime,size:media.size,externalUrl:media.externalUrl,legacySource:media.legacySource,isPublic:media.isPublic,createdAt:media.createdAt}).from(media).orderBy(desc(media.createdAt)).limit(2000),
 ]);
 const totalSize=files.reduce((sum,file)=>sum+file.size,0);
 return <><PageHeader title="مرکز فایل" subtitle="مدیریت تصاویر، ویدیوها و اسناد مورد استفاده در فروشگاه"/><FeatureIntro icon={FileImage} title="کتابخانه رسانه فروشگاه" text="فایل‌های فعلی و تصاویر واردشده از سایت قبلی را پوشه‌بندی، جست‌وجو و برای محصولات یا مقاله‌ها استفاده کنید."/><div className="my-5 grid gap-3 sm:grid-cols-3"><Stat icon={FileImage} label="تعداد فایل‌ها" value={faNum(files.length)}/><Stat icon={Folder} label="تعداد پوشه‌ها" value={faNum(folders.length)} tone="yellow"/><Stat icon={HardDrive} label="حجم ثبت‌شده" value={`${(totalSize/1048576).toLocaleString("fa-IR",{maximumFractionDigits:1})} مگابایت`} tone="violet"/></div><MediaLibraryClient initialFolders={folders} initialFiles={files}/></>;
}
