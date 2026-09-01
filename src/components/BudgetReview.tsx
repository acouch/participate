"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Treemap, { type TreemapDatum } from "@/src/components/Treemap";
import EditableText from "@/src/components/EditableText";
import { ordinalColorScale } from "@/src/lib/colors";
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
  /**
   * True only on the navigation that immediately follows a submit, so the
   * confirmation banner is shown once to the person who submitted and never to
   * someone opening the shared link.
   */
  justSubmitted?: boolean;
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
  justSubmitted = false,
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

  // The same chart the editor shows, sized by allocation and colored by change
  // vs. FY2026 (the +/- view).
  const treemapData: TreemapDatum[] = useMemo(
    () =>
      lineItems.map((d) => ({
        name: d.name,
        value: d.amount,
        category: d.category,
        percentChange: d.percentChange,
      })),
    [lineItems],
  );

  // Stable color per category — unused in "change" mode, but Treemap wants it.
  const categoryColor = useMemo(
    () => ordinalColorScale(Array.from(new Set(lineItems.map((d) => d.category)))),
    [lineItems],
  );

  // Collapsed by default so the written report leads; opened on print so the
  // chart is never silently dropped from a PDF.
  const [chartOpen, setChartOpen] = useState(false);
  useEffect(() => {
    const before = () => setChartOpen(true);
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, []);

  // Resolved after mount to avoid a server/client hydration mismatch. The
  // ?submitted=1 marker is stripped so the shared/copied URL is always the
  // clean one — and so a reload doesn't re-show the confirmation banner.
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("submitted")) {
      url.searchParams.delete("submitted");
      window.history.replaceState(null, "", url.toString());
    }
    setShareUrl(url.toString());
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
  // ?submitted=1 marks this one arrival so the confirmation banner shows only
  // to whoever just submitted — not on reload, and not to anyone opening the
  // shared link.
  const submit = () => {
    if (!onSubmit) return;
    const iso = new Date().toISOString();
    startTransition(async () => {
      await onSubmit(uuid, iso);
      router.push(`/budget/${uuid}?submitted=1`);
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
      {readOnly ?? (
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
          <Link
            href={`/budget/${uuid}/edit`}
            style={{ color: "#2563eb", fontSize: "0.9rem" }}
          >
            ← Back to editing
          </Link>
          <button type="button" onClick={submit} style={primaryButton}>
            Submit budget
          </button>
        </div>
      )}

      {/* Share / print actions float in the bottom corner, to the left of the
          global Feedback button (fixed at right/bottom 1.25rem, z-index 50). */}
      <div
        className="no-print"
        style={{
          position: "fixed",
          right: "10.5rem",
          bottom: "1.25rem",
          zIndex: 50,
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
        }}
      >
        <button type="button" onClick={copyLink} style={floatingButton}>
          {copied ? "Link copied!" : "Copy share link"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={floatingButton}
        >
          Print / PDF
        </button>
      </div>

      {readOnly && submittedAt && justSubmitted && (
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

      <p
        style={{
          padding: "1rem 0",
          borderTop: "1px solid #e5e5e5",
          borderBottom: "1px solid #e5e5e5",
          marginBottom: "1.5rem",
          fontSize: "0.95rem",
          lineHeight: 1.6,
          color: "#333",
        }}
      >
        This document represents a proposed budget for the General Fund for FY
        {fiscalYear}. The General Fund for FY{fiscalYear.slice(-2)} was{" "}
        {dollars.format(totalToSpend)}. This proposed budget includes{" "}
        <strong
          style={{
            color:
              remaining < 0 ? "#dc2626" : remaining > 0 ? "#2563eb" : "#16a34a",
          }}
        >
          {remaining === 0
            ? "every dollar allocated"
            : `${dollars.format(Math.abs(remaining))} ${
                remaining < 0 ? "over budget" : "unallocated"
              }`}
        </strong>
        .
      </p>

      {/* Additional information (hidden in the final view when empty) */}
      {(!readOnly || info) && (
        <section style={{ marginBottom: "1.5rem" }}>
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

      {/* ---- Budget visualization (collapsible, +/- view only) ---- */}
      <section style={{ marginBottom: "1.5rem" }}>
        <details
          open={chartOpen}
          onToggle={(e) => setChartOpen((e.target as HTMLDetailsElement).open)}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: "0.75rem",
            padding: "0.75rem 1rem",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.95rem",
              listStyle: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span aria-hidden style={{ color: "#888", fontSize: "0.75rem" }}>
              {chartOpen ? "▼" : "▶"}
            </span>
            Budget visualization
            <span style={{ fontWeight: 400, color: "#888", fontSize: "0.85rem" }}>
              — funding change vs. FY2026
            </span>
          </summary>

          <div style={{ marginTop: "1rem" }}>
            <ChangeKey />
            {chartOpen && (
              <Treemap
                data={treemapData}
                view="fund"
                valuePrefix="$"
                categoryColor={categoryColor}
                forceColorMode="change"
                hideKey
                hideBreadcrumb
              />
            )}
          </div>
        </details>
      </section>

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
/** Pill button matching the floating Feedback button it sits beside. */
const floatingButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  padding: "0.6rem 1rem",
  fontSize: "0.9rem",
  fontWeight: 600,
  border: "1px solid #d4d4d4",
  borderRadius: "999px",
  background: "#fff",
  color: "#333",
  boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
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

/**
 * Legend for the +/- coloring: a red→pale→green ramp matching Treemap's
 * diverging change scale (clamped at ±20%).
 */
function ChangeKey() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        marginBottom: "0.75rem",
        fontSize: "0.75rem",
        color: "#666",
      }}
    >
      <span>−20% or less</span>
      <div
        aria-hidden
        style={{
          flex: 1,
          height: "0.6rem",
          borderRadius: "999px",
          border: "1px solid #e5e5e5",
          background:
            "linear-gradient(to right, rgb(230,20,20), rgb(255,255,230), rgb(20,230,20))",
        }}
      />
      <span>+20% or more</span>
    </div>
  );
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
