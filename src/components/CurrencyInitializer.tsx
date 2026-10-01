"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { setCurrencyUnit } from "@/lib/util";
export function CurrencyInitializer({ currency, children }: { currency: string; children: ReactNode }) {
  setCurrencyUnit(currency);
  useEffect(() => setCurrencyUnit(currency), [currency]);
  return children;
}
