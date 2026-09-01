"use client";

import { useState } from "react";

export interface EditableTextProps {
  value: string;
  placeholder: string;
  as: "h1" | "p" | "textarea";
  style?: React.CSSProperties;
  readOnly?: boolean;
  onCommit: (value: string) => void;
}

/** Click-to-edit text: shows as static text, becomes an input on click. */
export default function EditableText({
  value,
  placeholder,
  as,
  style,
  readOnly,
  onCommit,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Read-only: render plain, non-interactive text.
  if (readOnly) {
    const text = value || "";
    if (!text) return null;
    if (as === "h1") return <h1 style={style}>{text}</h1>;
    if (as === "textarea")
      return <p style={{ ...style, whiteSpace: "pre-wrap" }}>{text}</p>;
    return <p style={style}>{text}</p>;
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== value.trim()) onCommit(draft.trim());
  };

  if (editing) {
    const shared: React.CSSProperties = {
      ...style,
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #2563eb",
      borderRadius: "0.375rem",
      padding: "0.4rem 0.5rem",
      font: "inherit",
    };
    return as === "textarea" ? (
      <textarea
        autoFocus
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        style={shared}
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
        style={shared}
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
    style: {
      ...style,
      cursor: "pointer",
      color: value ? style?.color : "#aaa",
      borderRadius: "0.375rem",
    } as React.CSSProperties,
  };

  if (as === "h1") return <h1 {...commonProps}>{display}</h1>;
  return <p {...commonProps}>{display}</p>;
}
