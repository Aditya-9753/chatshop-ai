import React from "react";
import { Link } from "react-router-dom";
import { cn } from "./ui/cn";

// ChatShop mark: a chat bubble holding a shopping bag
export function LogoMark({ className }) {
  return (
    <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg", className)}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v9a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 15.5z" />
        <path d="M9.5 9.5V8.75a2.5 2.5 0 0 1 5 0v.75" />
        <path d="M8.5 9.5h7l-.6 4.2a1 1 0 0 1-1 .8h-3.8a1 1 0 0 1-1-.8z" />
      </svg>
    </span>
  );
}

export default function Logo({ to = "/", className, compact }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 rounded-md", className)} aria-label="ChatShop AI home">
      <LogoMark />
      {!compact && <span className="text-[15px] font-semibold tracking-tight text-fg">ChatShop AI</span>}
    </Link>
  );
}
