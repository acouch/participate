"use client";

import { useState } from "react";
import { adjustButtonStyle, type OutcomeItem } from "@/src/lib/budget-format";

interface OutcomesEditorProps {
  outcomes: OutcomeItem[];
  onAdd: (description: string) => void;
  onDelete: (id: string) => void;
  required?: boolean;
}

/** Outcomes section inside the edit modal: existing list + add form. */
export default function OutcomesEditor({
  outcomes,
  onAdd,
  onDelete,
  required,
}: OutcomesEditorProps) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  };

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <label
        style={{
          display: "block",
          fontSize: "0.8rem",
          fontWeight: 600,
          marginBottom: "0.35rem",
        }}
      >
        Outcomes of this change
        {required && <span style={{ color: "#dc2626" }}> *</span>}
      </label>

      {outcomes.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: "0 0 0.5rem",
            padding: 0,
            display: "grid",
            gap: "0.35rem",
          }}
        >
          {outcomes.map((o) => (
            <li
              key={o.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                fontSize: "0.85rem",
                background: "#f6f6f6",
                borderRadius: "0.375rem",
                padding: "0.4rem 0.5rem",
              }}
            >
              <span style={{ flex: 1 }}>{o.description}</span>
              <button
                type="button"
                onClick={() => onDelete(o.id)}
                aria-label="Delete outcome"
                style={{
                  border: "none",
                  background: "none",
                  color: "#999",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: "0.4rem" }}>
        <input
          type="text"
          value={text}
          placeholder="e.g. Hire 50 more officers"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          style={{
            flex: 1,
            padding: "0.45rem 0.6rem",
            fontSize: "0.85rem",
            border: "1px solid #d4d4d4",
            borderRadius: "0.375rem",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          style={{
            ...adjustButtonStyle,
            opacity: text.trim() ? 1 : 0.5,
            cursor: text.trim() ? "pointer" : "not-allowed",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
