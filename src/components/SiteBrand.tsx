import { Leaf } from "lucide-react";
export function SiteBrand({ name, logoMediaId = 0, iconClassName = "h-5 w-5", boxClassName = "h-11 w-11" }: { name: string; logoMediaId?: number; iconClassName?: string; boxClassName?: string }) {
  return <span className={`${boxClassName} grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-700 text-white`}>{logoMediaId > 0 ? <img src={`/api/media/${logoMediaId}`} alt={name} className="h-full w-full object-contain" /> : <Leaf className={iconClassName} />}</span>;
}
