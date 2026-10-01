import { and,eq,sql } from 'drizzle-orm';
import { customerBalances,customerCreditEntries,customerWalletEntries,customerWallets,giftCards,giftCardEntries,users } from '@/db/schema';
import type { DB } from './types';
import { HttpError } from './util';
export async function quoteCredit(tx:DB,code:string,userId:number|null,total:number,lock=false){
 if(!userId)return {ok:false,error:'برای استفاده از اعتبار وارد حساب شوید',amount:0,giftCardId:null};
  const [user]=await tx.select({phone:users.phone}).from(users).where(eq(users.id,userId));if(!user)return {ok:false,error:'حساب یافت نشد',amount:0,giftCardId:null};
 if(code==='WALLET'){
  const walletQuery=tx.select().from(customerWallets).where(eq(customerWallets.userId,userId));const [wallet]=lock?await walletQuery.for('update'):await walletQuery;
  const balance=wallet?.balance??0;
  return {ok:balance>0,error:balance?'':'اعتبار کیف پول شما صفر است',amount:Math.min(total,balance),giftCardId:null};
 }
 const query=tx.select().from(giftCards).where(eq(giftCards.code,code));const [g]=lock?await query.for('update'):await query;
 if(!g||g.revoked||g.balance<=0||g.targetPhone&&g.targetPhone!==user.phone)return {ok:false,error:'کارت هدیه نامعتبر، بدون موجودی یا متعلق به شماره دیگری است',amount:0,giftCardId:null};
 return {ok:true,amount:Math.min(total,g.balance),giftCardId:g.id};
}
export async function addCredit(tx:DB,phone:string,amount:number,reference:string,note:string){
 if(!amount)return;
 const [user]=await tx.select({id:users.id}).from(users).where(eq(users.phone,phone));
 if(!user){const [entry]=await tx.insert(customerCreditEntries).values({phone,amount,reference,note}).onConflictDoNothing().returning();if(entry)await tx.insert(customerBalances).values({phone,balance:amount}).onConflictDoUpdate({target:customerBalances.phone,set:{balance:sql`${customerBalances.balance}+${amount}`,updatedAt:new Date()}});return;}
 const [entry]=await tx.insert(customerWalletEntries).values({userId:user.id,amount,type:'credit',description:note,reference:`credit:${reference}`}).onConflictDoNothing().returning();if(!entry)return;
 await tx.insert(customerWallets).values({userId:user.id,balance:amount}).onConflictDoUpdate({target:customerWallets.userId,set:{balance:sql`${customerWallets.balance}+${amount}`,updatedAt:new Date()}});
}
export async function reserveCredit(tx:DB,phone:string,amount:number,giftCardId:number|null,orderId:number,userId?:number){
 if(!amount)return;
 if(giftCardId){const [g]=await tx.update(giftCards).set({balance:sql`${giftCards.balance}-${amount}`}).where(and(eq(giftCards.id,giftCardId),eq(giftCards.revoked,false),sql`${giftCards.balance}>=${amount}`)).returning();if(!g)throw new HttpError(409,'موجودی کارت هدیه تغییر کرده است');await tx.insert(giftCardEntries).values({cardId:giftCardId,amount:-amount,reference:`order:${orderId}`});}
 else if(userId){const [w]=await tx.update(customerWallets).set({balance:sql`${customerWallets.balance}-${amount}`,updatedAt:new Date()}).where(and(eq(customerWallets.userId,userId),sql`${customerWallets.balance}>=${amount}`)).returning();if(!w)throw new HttpError(409,'موجودی کیف پول کافی نیست');await tx.insert(customerWalletEntries).values({userId,amount:-amount,type:'purchase',description:'پرداخت سفارش از کیف پول',reference:`order:${orderId}`});}else throw new HttpError(409,'برای استفاده از کیف پول وارد حساب شوید');
}
export async function restoreCredit(tx:DB,phone:string,amount:number,giftCardId:number|null,orderId:number,userId?:number){
 if(!amount)return;
 if(giftCardId){const [g]=await tx.select().from(giftCards).where(eq(giftCards.id,giftCardId)).for('update');if(g&&!g.revoked){const [e]=await tx.insert(giftCardEntries).values({cardId:giftCardId,amount,reference:`restore:${orderId}`}).onConflictDoNothing().returning();if(e)await tx.update(giftCards).set({balance:sql`${giftCards.balance}+${amount}`}).where(eq(giftCards.id,giftCardId));return}}
 if(userId){const [restored]=await tx.insert(customerWalletEntries).values({userId,amount,type:'refund',description:'بازگشت اعتبار سفارش',reference:`order-restore:${orderId}`}).onConflictDoNothing().returning();if(restored)await tx.insert(customerWallets).values({userId,balance:amount}).onConflictDoUpdate({target:customerWallets.userId,set:{balance:sql`${customerWallets.balance}+${amount}`,updatedAt:new Date()}});return;}
 await addCredit(tx,phone,amount,`restore:${orderId}`,'بازگشت اعتبار سفارش');
}
