"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { generateNoteAction } from "./actions";

export function SubmitButton({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function GenerateNote({ hasNote }: { hasNote: boolean }) {
  const [state, action, pending] = useActionState(async () => generateNoteAction(), {} as { error?: string });
  return (
    <form action={action} style={{ marginTop: 10 }}>
      <button type="submit" disabled={pending}>
        {pending ? "Writing your plan…" : hasNote ? "Regenerate today's plan" : "Generate today's plan"}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}

/** Tiny, safe Markdown renderer for the coach note (headings, bullets, bold, paragraphs). */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const inline = (s: string, k: number) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong> : part,
    );
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(<ul key={blocks.length}>{items.map((li, i) => <li key={i}>{inline(li, i)}</li>)}</ul>);
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*] /.test(line)) { list.push(line.replace(/^\s*[-*] /, "")); continue; }
    flush();
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,4}) (.*)$/);
    if (h) blocks.push(h[1].length <= 2 ? <h2 key={blocks.length}>{h[2]}</h2> : <h3 key={blocks.length}>{h[2]}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line, blocks.length)}</p>);
  }
  flush();
  return <div>{blocks}</div>;
}
