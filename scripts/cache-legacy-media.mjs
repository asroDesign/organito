import "dotenv/config";
import pg from "pg";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
const root=path.resolve(process.env.MEDIA_STORAGE_ROOT||path.join(process.cwd(),"storage","media"));
let cached=0,failed=0,skipped=0;
try{
 const {rows}=await client.query("select id,external_url,storage_path,mime,size from media where legacy_source='honey_kando' and external_url is not null order by id");
 for(const row of rows){
  try{
   const response=await fetch(row.external_url,{redirect:"follow",signal:AbortSignal.timeout(30000),headers:{"user-agent":"OrganoMarketplaceMediaMigration/1.0"}});
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const contentType=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
   if(!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm)|application\/pdf)$/.test(contentType)){skipped++;continue}
   const buffer=Buffer.from(await response.arrayBuffer());
   if(!buffer.length||buffer.length>50*1024*1024){skipped++;continue}
   const target=path.resolve(root,row.storage_path);if(!target.startsWith(root+path.sep))throw new Error("Unsafe media path");await mkdir(path.dirname(target),{recursive:true});await writeFile(target,buffer);
   await client.query("update media set mime=$1,size=$2,external_url=null,updated_at=now() where id=$3",[contentType,buffer.length,row.id]);cached++;
  }catch(error){failed++;console.warn(`Failed ${row.id}: ${error.message}`)}
 }
 console.log(`Legacy media cache complete: ${cached} cached, ${failed} unavailable, ${skipped} skipped.`);
}finally{client.release();await pool.end()}
