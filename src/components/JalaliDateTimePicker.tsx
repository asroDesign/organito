"use client";
import { JalaliDatePicker } from "./JalaliDatePicker";

/** Persian calendar date plus Tehran time; submits a Gregorian local datetime string. */
export function JalaliDateTimePicker({name,date,time,onDateChange,onTimeChange}:{name:string;date:string;time:string;onDateChange:(value:string)=>void;onTimeChange:(value:string)=>void}){
  return <div className="grid grid-cols-[1fr_120px] gap-2">
    <JalaliDatePicker value={date} onChange={onDateChange} allowEmpty placeholder="انتخاب تاریخ شمسی"/>
    <label className="text-xs text-slate-500">ساعت تهران<input type="time" value={time} onChange={e=>onTimeChange(e.target.value)} className="input mt-1"/></label>
    <input type="hidden" name={name} value={date&&time?`${date}T${time}`:""}/>
  </div>;
}
