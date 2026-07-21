"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OutcomeItem } from "@/src/components/BudgetEditor";

interface LineItem {
  name: string;
  category: string;
  priorAmount: number;
  /** Default allocation (2026 + baseline raise) before the user edited it. */
  baselineAmount: number;
  amount: number;
  percentChange: number | null;
}

interface BudgetReviewProps {
  uuid: string;
  fiscalYear: string;
  totalToSpend: number;
  name: string;
  tagline: string;
  additionalInfo: string;
  submittedAt: string | null;
  lineItems: LineItem[];
  outcomes: OutcomeItem[];
  /** Final, submitted view: no editing, no submit button. */
  readOnly?: boolean;
  onSaveIntro?: (
    uuid: string,
    fields: { name?: string; tagline?: string; additionalInfo?: string },
  ) => Promise<void>;
  onSubmit?: (uuid: string, submittedAtIso: string) => Promise<void>;
  onAddOutcome?: (
    uuid: string,
    department: string,
    description: string,
  ) => Promise<OutcomeItem | null>;
  onDeleteOutcome?: (uuid: string, outcomeId: string) => Promise<void>;
}

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const signedPct = (pct: number) =>
  `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
const pctColor = (pct: number | null) =>
  pct == null ? "#666" : pct > 0 ? "#16a34a" : pct < 0 ? "#dc2626" : "#666";

export default function BudgetReview({
  uuid,
  fiscalYear,
  totalToSpend,
  name: initialName,
  tagline: initialTagline,
  additionalInfo: initialInfo,
  submittedAt: initialSubmittedAt,
  lineItems,
  outcomes: initialOutcomes,
  readOnly = false,
  onSaveIntro,
  onSubmit,
  onAddOutcome,
  onDeleteOutcome,
}: BudgetReviewProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [tagline, setTagline] = useState(initialTagline);
  const [info, setInfo] = useState(initialInfo);
  const [outcomes, setOutcomes] = useState(initialOutcomes);
  const [submittedAt, setSubmittedAt] = useState(initialSubmittedAt);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();

  const totalSpent = useMemo(
    () => lineItems.reduce((s, d) => s + d.amount, 0),
    [lineItems],
  );
  const remaining = totalToSpend - totalSpent;

  const outcomesByDept = useMemo(() => {
    const map = new Map<string, OutcomeItem[]>();
    for (const o of outcomes) {
      const list = map.get(o.department) ?? [];
      list.push(o);
      map.set(o.department, list);
    }
    return map;
  }, [outcomes]);

  // Resolved after mount to avoid a server/client hydration mismatch.
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  const commitIntro = (fields: {
    name?: string;
    tagline?: string;
    additionalInfo?: string;
  }) => {
    if (!onSaveIntro) return;
    startTransition(() => onSaveIntro(uuid, fields));
  };

  const addOutcome = (department: string, description: string) => {
    const text = description.trim();
    if (!text || !onAddOutcome) return;
    const tempId = `temp-${department}-${outcomes.length}-${text.length}`;
    setOutcomes((prev) => [
      ...prev,
      { id: tempId, department, description: text },
    ]);
    startTransition(async () => {
      const saved = await onAddOutcome(uuid, department, text);
      setOutcomes((prev) =>
        saved
          ? prev.map((o) => (o.id === tempId ? saved : o))
          : prev.filter((o) => o.id !== tempId),
      );
    });
  };

  const removeOutcome = (id: string) => {
    if (!onDeleteOutcome) return;
    setOutcomes((prev) => prev.filter((o) => o.id !== id));
    startTransition(() => onDeleteOutcome(uuid, id));
  };

  // Submitting locks the budget and navigates to the final /budget/{id} view.
  const submit = () => {
    if (!onSubmit) return;
    const iso = new Date().toISOString();
    startTransition(async () => {
      await onSubmit(uuid, iso);
      router.push(`/budget/${uuid}`);
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  // Departments the user actually changed from the default baseline.
  const changed = lineItems.filter((d) => d.amount !== d.baselineAmount);

  return (
    <div style={{ padding: "1rem 0 3rem" }}>
      {/* Toolbar — hidden when printing. */}
      <div
        className="no-print"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        {readOnly ? (
          <span style={{ fontSize: "0.9rem", color: "#666" }}>
            Final submitted budget
          </span>
        ) : (
          <Link
            href={`/budget/${uuid}/edit`}
            style={{ color: "#2563eb", fontSize: "0.9rem" }}
          >
            ← Back to editing
          </Link>
        )}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={copyLink}
            style={secondaryButton}
          >
            {copied ? "Link copied!" : "Copy share link"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            style={secondaryButton}
          >
            Print / PDF
          </button>
          {!readOnly && (
            <button type="button" onClick={submit} style={primaryButton}>
              Submit budget
            </button>
          )}
        </div>
      </div>

      {readOnly && submittedAt && (
        <p
          className="no-print"
          style={{
            padding: "0.6rem 0.9rem",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "0.5rem",
            color: "#065f46",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          ✓ Submitted {new Date(submittedAt).toLocaleString()}. Share this page:{" "}
          <span style={{ fontWeight: 600 }}>{shareUrl}</span>
        </p>
      )}

      {/* ---- Shareable document ---- */}
      <p style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "#888", fontSize: "0.75rem", fontWeight: 600 }}>
        City of Philadelphia · Proposed budget for FY {fiscalYear}
      </p>

      <EditableText
        value={name}
        placeholder="Your mayoral or project name"
        as="h1"
        readOnly={readOnly}
        style={{ fontSize: "2rem", margin: "0.25rem 0" }}
        onCommit={(v) => {
          setName(v);
          commitIntro({ name: v });
        }}
      />

      <EditableText
        value={tagline}
        placeholder="What does your budget deliver?"
        as="p"
        readOnly={readOnly}
        style={{ fontSize: "1.25rem", fontStyle: "italic", color: "#444", margin: "0 0 1rem" }}
        onCommit={(v) => {
          setTagline(v);
          commitIntro({ tagline: v });
        }}
      />

      <div
        style={{
          display: "flex",
          gap: "2rem",
          flexWrap: "wrap",
          padding: "1rem 0",
          borderTop: "1px solid #e5e5e5",
          borderBottom: "1px solid #e5e5e5",
          marginBottom: "1.5rem",
        }}
      >
        <Stat label="To spend" value={dollars.format(totalToSpend)} />
        <Stat label="Allocated" value={dollars.format(totalSpent)} />
        <Stat
          label={remaining < 0 ? "Over budget" : "Unallocated"}
          value={dollars.format(Math.abs(remaining))}
          color={remaining < 0 ? "#dc2626" : remaining > 0 ? "#2563eb" : "#16a34a"}
        />
      </div>

      {/* Additional information (hidden in the final view when empty) */}
      {(!readOnly || info) && (
        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Additional information</h2>
          <EditableText
            value={info}
            placeholder="Add context or further explanation for your budget (optional)…"
            as="textarea"
            readOnly={readOnly}
            style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "#333" }}
            onCommit={(v) => {
              setInfo(v);
              commitIntro({ additionalInfo: v });
            }}
          />
        </section>
      )}

      {/* ---- What this budget delivers — the emphasized outcomes summary ---- */}
      <section
        style={{
          background: "#f8fafc",
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            margin: "0 0 1rem",
          }}
        >
          What this budget delivers
        </h2>
        {changed.length === 0 ? (
          <p style={{ color: "#888", fontSize: "0.95rem" }}>
            No funding changes yet — adjust a department to describe what your
            budget will deliver.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "1.25rem",
            }}
          >
            {changed.map((d) => {
              const list = outcomesByDept.get(d.name) ?? [];
              return (
                <li key={d.name}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.5rem",
                      marginBottom: "0.4rem",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                      {d.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: pctColor(d.percentChange),
                      }}
                    >
                      {d.amount > d.baselineAmount ? "more funding" : "less funding"}
                    </span>
                  </div>
                  {list.length > 0 ? (
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "grid",
                        gap: "0.4rem",
                      }}
                    >
                      {list.map((o) => (
                        <li
                          key={o.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.5rem",
                            fontSize: "1rem",
                            lineHeight: 1.5,
                            color: "#1f2937",
                          }}
                        >
                          <span aria-hidden style={{ color: "#2563eb" }}>
                            →
                          </span>
                          <span style={{ flex: 1 }}>{o.description}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              className="no-print"
                              onClick={() => removeOutcome(o.id)}
                              aria-label="Delete outcome"
                              style={{
                                border: "none",
                                background: "none",
                                color: "#bbb",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !readOnly && (
                      <p
                        className="no-print"
                        style={{ fontSize: "0.85rem", color: "#dc2626", margin: "0 0 0.4rem" }}
                      >
                        Add an outcome to describe what this change delivers.
                      </p>
                    )
                  )}
                  {!readOnly && (
                    <div className="no-print" style={{ marginTop: "0.4rem" }}>
                      <OutcomeAdder onAdd={(text) => addOutcome(d.name, text)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Funding changes — the money view, without outcomes */}
      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={sectionHeading}>Funding changes ({changed.length})</h2>
        {changed.length === 0 ? (
          <p style={{ color: "#888", fontSize: "0.9rem" }}>
            No departments changed from the baseline yet.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.4rem" }}>
            {changed.map((d) => (
              <li
                key={d.name}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem",
                  alignItems: "baseline",
                  padding: "0.5rem 0.75rem",
                  border: "1px solid #eee",
                  borderRadius: "0.5rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                <span style={{ whiteSpace: "nowrap" }}>
                  {dollars.format(d.amount)}{" "}
                  <span style={{ color: pctColor(d.percentChange), fontWeight: 600 }}>
                    ({signedPct(d.percentChange as number)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Full budget table */}
      <section>
        <h2 style={sectionHeading}>Full General Fund budget</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={th}>Department</th>
              <th style={{ ...th, textAlign: "right" }}>Amount</th>
              <th style={{ ...th, textAlign: "right" }}>vs. FY2026</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((d) => (
              <tr key={d.name} style={{ borderTop: "1px solid #f0f0f0" }}>
                <td style={td}>
                  {d.name}
                  <span style={{ color: "#999", marginLeft: "0.4rem", fontSize: "0.75rem" }}>
                    {d.category}
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>{dollars.format(d.amount)}</td>
                <td style={{ ...td, textAlign: "right", color: pctColor(d.percentChange), fontWeight: 600 }}>
                  {d.percentChange == null ? "—" : signedPct(d.percentChange)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  border: "none",
  borderRadius: "0.5rem",
  background: "#2563eb",
  color: "#fff",
  cursor: "pointer",
};
const secondaryButton: React.CSSProperties = {
  padding: "0.55rem 0.9rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  border: "1px solid #d4d4d4",
  borderRadius: "0.5rem",
  background: "#fff",
  color: "#333",
  cursor: "pointer",
};
const sectionHeading: React.CSSProperties = {
  fontSize: "0.8rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#888",
  margin: "0 0 0.6rem",
};
const th: React.CSSProperties = { padding: "0.4rem 0.5rem", fontWeight: 600 };
const td: React.CSSProperties = { padding: "0.4rem 0.5rem" };

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: color ?? "#111" }}>
        {value}
      </div>
    </div>
  );
}

interface EditableTextProps {
  value: string;
  placeholder: string;
  as: "h1" | "p" | "textarea";
  style?: React.CSSProperties;
  readOnly?: boolean;
  onCommit: (value: string) => void;
}

/** Click-to-edit text: shows as static text, becomes an input on click. */
function EditableText({
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

/** A single "add an outcome" input (the list/removal lives in the summary). */
function OutcomeAdder({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  };
  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      <input
        type="text"
        value={text}
        placeholder="Add an outcome…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        style={{
          flex: 1,
          padding: "0.35rem 0.5rem",
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
          ...secondaryButton,
          padding: "0.35rem 0.7rem",
          fontSize: "0.8rem",
          opacity: text.trim() ? 1 : 0.5,
        }}
      >
        Add
      </button>
    </div>
  );
}
