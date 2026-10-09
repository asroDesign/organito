"use client";
import { useEffect,useRef,useState } from 'react';
import { Modal } from './Modal';
export function InvoiceModal({src,onClose,title="پیش‌نمایش و چاپ فاکتور"}:{src:string;onClose:()=>void;title?:string}){
 const frame=useRef<HTMLIFrameElement>(null),button=useRef<HTMLButtonElement>(null);const [ready,setReady]=useState(false);
 const print=()=>{if(ready){frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print()}};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Enter'&&!e.repeat&&ready){e.preventDefault();frame.current?.contentWindow?.focus();frame.current?.contentWindow?.print()}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[ready]);
 return <Modal title={title} onClose={onClose} wide><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-inner"><iframe ref={frame} title="پیش‌نمایش فاکتور" src={src} className="h-[65vh] w-full bg-white" onLoad={()=>{setReady(true);button.current?.focus()}}/></div><div className="mt-4 flex flex-col-reverse justify-end gap-3 sm:flex-row"><button className="btn-ghost" onClick={onClose}>بستن</button><button ref={button} disabled={!ready} className="btn-primary" onClick={print}>{ready?'تأیید و چاپ — Enter':'آماده‌سازی فاکتور…'}</button></div></Modal>
}
export function InvoiceButton({src}:{src:string}){const [open,setOpen]=useState(false);return <><button className="btn-sm" onClick={()=>setOpen(true)}>جزئیات و چاپ</button>{open&&<InvoiceModal src={src} onClose={()=>setOpen(false)}/>}</>}
