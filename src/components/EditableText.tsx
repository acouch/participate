"use client";

import { useState } from "react";

export interface EditableTextProps {
  value: string;
  placeholder: string;
  as: "h1" | "p" | "textarea";
  /** Tailwind classes applied to the rendered text and its editing input. */
  className?: string;
  readOnly?: boolean;
  onCommit: (value: string) => void;
}

/** Click-to-edit text: shows as static text, becomes an input on click. */
export default function EditableText({
  value,
  placeholder,
  as,
  className = "",
  readOnly,
  onCommit,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Read-only: render plain, non-interactive text.
  if (readOnly) {
    const text = value || "";
    if (!text) return null;
    if (as === "h1") return <h1 className={className}>{text}</h1>;
    if (as === "textarea")
      return <p className={`${className} whitespace-pre-wrap`}>{text}</p>;
    return <p className={className}>{text}</p>;
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
  };

  if (editing) {
    const shared = `${className} box-border w-full rounded-md border border-blue-600 px-2 py-[0.4rem] font-[inherit]`;
    return as === "textarea" ? (
      <textarea
        autoFocus
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        className={shared}
      />
    ) : (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={shared}
      />
    );
  }

  const display = value || placeholder;
  const commonProps = {
    onClick: () => {
      setDraft(value);
      setEditing(true);
    },
    title: "Click to edit",
    // A blank value shows the placeholder greyed out; otherwise the caller's
    // own text color (from `className`) applies.
    className: `${className} cursor-pointer rounded-md${
      value ? "" : " text-neutral-400"
    }`,
  };

  if (as === "h1") return <h1 {...commonProps}>{display}</h1>;
  return <p {...commonProps}>{display}</p>;
}
