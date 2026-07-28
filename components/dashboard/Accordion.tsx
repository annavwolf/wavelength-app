"use client";

import { useState, type ReactNode } from "react";

// A quiet, collapsible accordion row. Self-managing open state so callers don't
// have to thread a Set around. Mirrors the old Z3Section styling.
export default function Accordion({
  title,
  right,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  right?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-black/10 rounded-xl overflow-hidden bg-black/[0.015]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 text-left hover:bg-black/5 transition-colors"
      >
        <span className="text-sm font-medium flex items-center gap-3">{title}</span>
        <span className="flex items-center gap-3">
          {right}
          <span className="text-[var(--color-grey)] text-lg leading-none">{open ? "−" : "+"}</span>
        </span>
      </button>
      {open && <div className="border-t border-black/5 px-5 py-4">{children}</div>}
    </div>
  );
}
