import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { randomBytes } from 'node:crypto';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db, pool } from '@/db';
import { users, centralLoyaltyMembers, sellerLoyaltyMembers, sellerLoyaltyClubs, customerGroups, customerGroupMembers, marketingCampaigns, campaignDeliveries, centralPosSales, sellerPosSales, orders, reviews, discountCodes, sellerLoyaltyRewards } from '@/db/schema';
import { sendDirectSms, sendSellerClubSms } from './sms';
import { isJalaliBirthday } from './commerce-common';
import { todayIso } from './jalali';
import type { DB } from './types';
export const ownerScope=(column:AnyPgColumn,sellerId:number|null)=>sellerId===null?isNull(column):eq(column,sellerId);
export type AudienceMember={name:string;phone:string;birthdate:Date|null;smsConsent:boolean;createdAt:Date};
export async function audience(sellerId:number|null):Promise<AudienceMember[]> {
 if(sellerId!==null){const rows=await db.select({m:sellerLoyaltyMembers}).from(sellerLoyaltyMembers).innerJoin(sellerLoyaltyClubs,eq(sellerLoyaltyMembers.clubId,sellerLoyaltyClubs.id)).where(eq(sellerLoyaltyClubs.sellerId,sellerId));return rows.map(x=>x.m)}
 const map=new Map<string,AudienceMember>();
 for(const u of await db.select({name:users.name,phone:users.phone,birthdate:users.birthdate,smsConsent:users.smsConsent,createdAt:users.createdAt}).from(users).where(and(eq(users.role,'customer'),eq(users.isActive,true))))map.set(u.phone,u);
 for(const m of await db.select().from(centralLoyaltyMembers)){const u=map.get(m.phone);map.set(m.phone,{...m,birthdate:m.birthdate??u?.birthdate??null})}
 return [...map.values()];
}
export async function issueReward(tx:DB,sellerId:number|null,phone:string,percent:number,minOrder:number,days:number,reference:number|null=null){
 const code=`${sellerId===null?'NEXT':'CLUB'}-${randomBytes(7).toString('hex').toUpperCase()}`;
 if(sellerId===null)await tx.insert(discountCodes).values({code,title:'هدیه خرید بعدی',type:'percent',value:percent,minOrder,targetPhone:phone,usageLimit:1,perUserLimit:1,endsAt:new Date(Date.now()+days*86400000)});
 else {const [club]=await tx.select().from(sellerLoyaltyClubs).where(eq(sellerLoyaltyClubs.sellerId,sellerId));if(!club)throw new Error('باشگاه فروشنده یافت نشد');await tx.insert(sellerLoyaltyRewards).values({sellerId,clubId:club.id,memberPhone:phone,code,saleId:reference,discountPercent:percent,minSubtotal:minOrder,expiresAt:new Date(Date.now()+days*86400000)})}
 return code;
}
async function candidates(c:typeof marketingCampaigns.$inferSelect,people:AudienceMember[],now:Date){
 const map=new Map(people.filter(p=>p.smsConsent).map(p=>[p.phone,p]));const events:{p:AudienceMember;key:string}[]=[];
 const add=(phone:string,key:string)=>{const p=map.get(phone);if(p)events.push({p,key})};
 const today=todayIso();const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',hour:'2-digit',hourCycle:'h23'}).format(now));
 if(c.type==='instant'||c.type==='scheduled'){if(c.lastRunAt||(c.type==='scheduled'&&(!c.scheduleAt||c.scheduleAt>now)))return events;for(const p of map.values())events.push({p,key:'once'})}
 if(c.type==='birthday'&&hour>=c.sendHour)for(const p of map.values())if(p.birthdate&&isJalaliBirthday(p.birthdate,today))events.push({p,key:`birthday:${today}`});
 if(c.type==='welcome')for(const p of map.values())if(p.createdAt>=c.createdAt)events.push({p,key:`welcome:${p.phone}`});
 if(c.type==='purchase'){
  if(c.sellerId===null){for(const x of await db.select().from(centralPosSales).where(and(gte(centralPosSales.createdAt,c.createdAt),eq(centralPosSales.status,'completed'))))add(x.customerPhone,`central:${x.id}`);
   for(const {o,u} of await db.select({o:orders,u:users}).from(orders).innerJoin(users,eq(users.id,orders.customerId)).where(and(gte(orders.updatedAt,c.createdAt),eq(orders.paymentStatus,'paid'))))add(u.phone,`order:${o.id}`);
  }else for(const x of await db.select().from(sellerPosSales).where(and(eq(sellerPosSales.sellerId,c.sellerId),gte(sellerPosSales.createdAt,c.createdAt),eq(sellerPosSales.status,'completed'))))add(x.customerPhone,`seller:${x.id}`);
 }
 if(c.type==='review'&&c.sellerId===null)for(const {r,u} of await db.select({r:reviews,u:users}).from(reviews).innerJoin(users,eq(users.id,reviews.userId)).where(and(gte(reviews.createdAt,c.createdAt),eq(reviews.status,'approved'))))add(u.phone,`review:${r.id}`);
 return events;
}
let running=false;
export async function processCampaigns(){
 if(running)return;running=true;const lock=await pool.connect();let acquired=false;
 try{
  acquired=(await lock.query('select pg_try_advisory_lock(99127) as locked')).rows[0].locked;if(!acquired)return;
  // A provider timeout/crash must never cause an automatic duplicate send.
  await db.update(campaignDeliveries).set({status:'unknown'}).where(and(eq(campaignDeliveries.status,'sending'),sql`${campaignDeliveries.processedAt} < now()-interval '10 minutes'`));
  const list=await db.select().from(marketingCampaigns).where(eq(marketingCampaigns.status,'active'));
  let budget=100;
  for(const c of list){
   let people=await audience(c.sellerId);
   if(c.groupId){const members=await db.select().from(customerGroupMembers).where(eq(customerGroupMembers.groupId,c.groupId));const phones=new Set(members.map(m=>m.phone));people=people.filter(p=>phones.has(p.phone))}
   const events=await candidates(c,people,new Date());
   for(const {p,key} of events)await db.insert(campaignDeliveries).values({campaignId:c.id,phone:p.phone,name:p.name,eventKey:key,body:c.body}).onConflictDoNothing();
   if((c.type==='instant'||c.type==='scheduled')&&!c.lastRunAt&&(c.type==='instant'||(c.scheduleAt&&c.scheduleAt<=new Date())))await db.update(marketingCampaigns).set({lastRunAt:new Date()}).where(eq(marketingCampaigns.id,c.id));
   if(budget<=0)continue;
   const jobs=await db.select().from(campaignDeliveries).where(and(eq(campaignDeliveries.campaignId,c.id),eq(campaignDeliveries.status,'pending'))).orderBy(campaignDeliveries.id).limit(budget);
   const consented=new Set(people.filter(p=>p.smsConsent).map(p=>p.phone));
   for(const job of jobs){budget--;
    const [live]=await db.select({status:marketingCampaigns.status}).from(marketingCampaigns).where(eq(marketingCampaigns.id,c.id));if(live?.status!=='active')break;
    if(!consented.has(job.phone)){await db.update(campaignDeliveries).set({status:'skipped',processedAt:new Date()}).where(eq(campaignDeliveries.id,job.id));continue}
    const text=await db.transaction(async tx=>{
     const [claimed]=await tx.update(campaignDeliveries).set({status:'sending',processedAt:new Date()}).where(and(eq(campaignDeliveries.id,job.id),eq(campaignDeliveries.status,'pending'))).returning();if(!claimed)return null;
     const reward=job.rewardCode??(c.rewardPercent>0?await issueReward(tx,c.sellerId,job.phone,c.rewardPercent,c.minOrder,c.validityDays):null);
     const body=job.body.replace(/\{\{\s*name\s*\}\}/g,job.name).replace(/\{\{\s*phone\s*\}\}/g,job.phone).replace(/\{\{\s*code\s*\}\}/g,reward??'').replace(/\{\{\s*percent\s*\}\}/g,String(c.rewardPercent))+(reward&&!job.body.includes('{{code}}')?` کد خرید بعدی: ${reward}`:'');
     await tx.update(campaignDeliveries).set({rewardCode:reward}).where(eq(campaignDeliveries.id,job.id));return body;
    });if(text===null)continue;
    const status=c.sellerId===null?await sendDirectSms(`campaign:${c.id}`,job.phone,text):await sendSellerClubSms(c.sellerId,job.phone,text);
    await db.update(campaignDeliveries).set({status,processedAt:new Date()}).where(eq(campaignDeliveries.id,job.id));
   }
   if(['instant','scheduled'].includes(c.type)){const [{n}]=await db.select({n:sql<number>`count(*)::int`}).from(campaignDeliveries).where(and(eq(campaignDeliveries.campaignId,c.id),sql`${campaignDeliveries.status} in ('pending','sending')`));if(n===0&&(c.lastRunAt||events.length))await db.update(marketingCampaigns).set({status:'done'}).where(eq(marketingCampaigns.id,c.id))}
  }
 }finally{if(acquired)await lock.query('select pg_advisory_unlock(99127)');lock.release();running=false}
}
