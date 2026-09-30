import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";

export const MEDIA_STORAGE_ROOT=path.resolve(process.env.MEDIA_STORAGE_ROOT||path.join(process.cwd(),"storage","media"));

export function normalizeMediaPath(value:string){
 const relative=value.replace(/\\/g,"/").replace(/^\/+/,"").split("/").filter(Boolean).join("/");
 if(!relative||relative.split("/").includes(".."))throw new Error("Invalid media path");
 return relative;
}
export function mediaDiskPath(relative:string){
 const safe=normalizeMediaPath(relative),absolute=path.resolve(MEDIA_STORAGE_ROOT,safe);
 if(absolute!==MEDIA_STORAGE_ROOT&&!absolute.startsWith(MEDIA_STORAGE_ROOT+path.sep))throw new Error("Invalid media path");
 return absolute;
}
export function newMediaPath(filename:string){
 const now=new Date(),ext=path.extname(filename).toLowerCase().replace(/[^.a-z0-9]/g,"").slice(0,10);
 return `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth()+1).padStart(2,"0")}/${randomUUID()}${ext}`;
}
export async function writeMediaFile(relative:string,data:Buffer){const target=mediaDiskPath(relative);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,data,{flag:"wx"});return target}
export async function readMediaFile(relative:string){return readFile(mediaDiskPath(relative))}
export async function removeMediaFile(relative:string|null|undefined){if(!relative)return;await rm(mediaDiskPath(relative),{force:true}).catch(()=>undefined)}
