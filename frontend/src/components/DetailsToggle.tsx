"use client";

import { useState, type ReactNode } from "react";

export function DetailsToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 text-sm font-medium text-lake"
      >
        <span aria-hidden className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
          &gt;&gt;
        </span>
        {open ? "Hide details" : label}
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
