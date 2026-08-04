"use client";

// Minimal markdown renderer for the Phase 4 read-only artifacts (meeting agenda,
// check-in protocol). Handles only what those documents use: #/##/### headings,
// --- rules, > blockquotes, - / ☐ list items, and inline **bold** / *italic*.
// Deliberately tiny — no dependency, print-friendly output.

import React from "react";

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** and *italic* (bold checked first).
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyBase}-i${i}`}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (list.length === 0) return;
    const items = [...list];
    blocks.push(
      <ul key={`ul${key++}`} className="space-y-1.5 my-3 pl-5 list-disc marker:text-[var(--color-grey)]">
        {items.map((it, idx) => (
          <li key={idx} className="leading-relaxed">{renderInline(it, `li${key}-${idx}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed === "") { flushList(); continue; }
    if (trimmed === "---") { flushList(); blocks.push(<hr key={`hr${key++}`} className="my-6 border-black/10" />); continue; }

    if (trimmed.startsWith("### ")) {
      flushList();
      blocks.push(<h3 key={`h3${key++}`} className="text-base font-semibold mt-5 mb-2">{renderInline(trimmed.slice(4), `h3${key}`)}</h3>);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      blocks.push(<h2 key={`h2${key++}`} className="text-lg font-semibold mt-6 mb-2" style={{ fontFamily: "Playfair Display, serif" }}>{renderInline(trimmed.slice(3), `h2${key}`)}</h2>);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      blocks.push(<h1 key={`h1${key++}`} className="text-2xl mt-2 mb-3" style={{ fontFamily: "Playfair Display, serif" }}>{renderInline(trimmed.slice(2), `h1${key}`)}</h1>);
      continue;
    }
    if (trimmed.startsWith("> ")) {
      flushList();
      blocks.push(
        <blockquote key={`bq${key++}`} className="border-l-3 border-[var(--color-navy)]/40 pl-4 my-3 italic text-[var(--color-ink)]"
          style={{ borderLeftWidth: 3 }}>
          {renderInline(trimmed.slice(2), `bq${key}`)}
        </blockquote>
      );
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("☐ ")) {
      list.push(trimmed.startsWith("☐ ") ? trimmed : trimmed.slice(2));
      continue;
    }

    flushList();
    blocks.push(<p key={`p${key++}`} className="leading-relaxed my-2">{renderInline(trimmed, `p${key}`)}</p>);
  }
  flushList();

  return <div className="text-sm text-[var(--color-ink)]">{blocks}</div>;
}
