"use client";
import { Printer } from "lucide-react";

export function PrintButton({ label = "چاپ" }: { label?: string }) {
  return <button onClick={() => window.print()} className="btn-primary no-print"><Printer className="h-4 w-4" />{label}</button>;
}
