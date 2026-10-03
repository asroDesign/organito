"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
export function AdminShellFrame({ children, content }: { children: ReactNode; content: ReactNode }) {
  return usePathname() === "/admin/home-builder" ? content : children;
}
