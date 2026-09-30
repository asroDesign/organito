import "dotenv/config";
import pg from "pg";
import { readFile } from "node:fs/promises";

const sourceFile=process.argv[2];
if(!sourceFile)throw new Error("Usage: node scripts/import-legacy-media.mjs <mysql-dump.sql>");
const sqlText=await readFile(sourceFile,"utf8");
const base=(process.env.LEGACY_MEDIA_BASE_URL||"https://honeykando.ir/storage/").replace(/\/+$/,"")+"/";

function blocks(table){
 const marker=`INSERT INTO \`${table}\``;const result=[];let from=0;
 while(true){const start=sqlText.indexOf(marker,from);if(start<0)break;const values=sqlText.indexOf(" VALUES",start);if(values<0)break;let quote=false,escape=false,end=values+7;
  for(;end<sqlText.length;end++){const c=sqlText[end];if(quote){if(escape)escape=false;else if(c==="\\")escape=true;else if(c==="'")quote=false;}else if(c==="'")quote=true;else if(c===";")break;}
  result.push(sqlText.slice(values+7,end));from=end+1;
 }
 return result;
}
function tuples(input){
 const rows=[];let row=null,token="",quote=false,escape=false;
 const push=()=>{const raw=token.trim();row.push(raw==="NULL"?null:raw);token=""};
 for(let i=0;i<input.length;i++){const c=input[i];if(!row){if(c==="(")row=[];continue}if(quote){if(escape){token+=c==="n"?"\n":c==="r"?"\r":c==="t"?"\t":c;escape=false}else if(c==="\\")escape=true;else if(c==="'")quote=false;else token+=c;continue}if(c==="'"){quote=true;continue}if(c===","){push();continue}if(c===")"){push();rows.push(row);row=null;continue}token+=c}return rows;
}
const folders=blocks("media_folders").flatMap(tuples);
const files=blocks("media_files").flatMap(tuples);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const client=await pool.connect();
try{
 await client.query("BEGIN");
 for(const r of folders){if(r[8]!==null)continue;await client.query(`insert into media_folders(name,slug,parent_id,color,legacy_id,created_at,updated_at) values($1,$2,null,$3,$4,coalesce($5::timestamptz,now()),coalesce($6::timestamptz,now())) on conflict (legacy_id) where legacy_id is not null do update set name=excluded.name,slug=excluded.slug,color=excluded.color,updated_at=excluded.updated_at`,[r[2]||r[3]||`folder-${r[0]}`,r[4]||`folder-${r[0]}`,r[3],Number(r[0]),r[6],r[7]]);}
 const {rows:folderRows}=await client.query("select id,legacy_id from media_folders where legacy_id is not null"),map=new Map(folderRows.map(x=>[Number(x.legacy_id),Number(x.id)]));
 for(const r of folders){const id=map.get(Number(r[0])),parent=map.get(Number(r[5]));if(id&&parent)await client.query("update media_folders set parent_id=$1 where id=$2",[parent,id]);}
 let imported=0;
 for(const r of files){if(r[11]!==null)continue;const legacyId=Number(r[0]),url=String(r[7]||"").replace(/\\\//g,"/").replace(/^\/+/,""),filename=url.split("/").pop()||`${r[2]||"legacy"}-${legacyId}`;await client.query(`insert into media(filename,alt,folder_id,mime,size,storage_path,external_url,legacy_source,legacy_id,uploaded_by,is_public,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,'honey_kando',$8,null,$9,coalesce($10::timestamptz,now()),coalesce($11::timestamptz,now())) on conflict (legacy_source,legacy_id) where legacy_source is not null and legacy_id is not null do update set filename=excluded.filename,alt=excluded.alt,folder_id=excluded.folder_id,mime=excluded.mime,size=excluded.size,storage_path=excluded.storage_path,is_public=excluded.is_public,updated_at=excluded.updated_at`,[filename,r[3],map.get(Number(r[4]))??null,r[5]||"application/octet-stream",Number(r[6])||0,url,base+url,legacyId,r[12]!=="private",r[9],r[10]]);imported++;}
 await client.query("COMMIT");console.log(`Legacy media imported: ${imported} files, ${folders.length} folders.`);
}catch(error){await client.query("ROLLBACK");throw error}finally{client.release();await pool.end()}
