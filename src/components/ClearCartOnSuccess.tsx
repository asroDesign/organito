"use client";
import { useEffect } from "react";
import { writeCart } from "./client";

export function ClearCartOnSuccess() {
  useEffect(() => { writeCart([]); }, []);
  return null;
}
