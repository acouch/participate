"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
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

const signedPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

/**
 * Compact dollars for inline chips: $1.2B, $45M, $900K. Formatted by hand
 * rather than with Intl's `notation: "compact"`, whose trailing-zero handling
 * differs between Node and browser ICU and caused a hydration mismatch.
 */
function compactDollars(value: number): string {
  const n = Math.abs(value);
  const [divisor, suffix] =
    n >= 1e9
      ? [1e9, "B"]
      : n >= 1e6
        ? [1e6, "M"]
        : n >= 1e3
          ? [1e3, "K"]
          : [1, ""];
  const scaled = n / divisor;
  // One decimal below 100 (e.g. $1.2B, $45.3M), none above (e.g. $124M).
  const text =
    scaled < 100 && divisor > 1
      ? scaled.toFixed(1)
      : Math.round(scaled).toString();
  return `$${text.replace(/\.0$/, "")}${suffix}`;
}
/**
 * The current location with the transient ?submitted=1 marker removed — the
 * URL that should be shared. Cached because useSyncExternalStore requires a
 * referentially stable snapshot between store changes.
 */
let cachedHref = "";
let cachedClean = "";
function getCleanLocation(): string {
  const href = window.location.href;
  if (href !== cachedHref) {
    cachedHref = href;
    const url = new URL(href);
    url.searchParams.delete("submitted");
    cachedClean = url.toString();
  }
  return cachedClean;
}

/** history.replaceState doesn't emit an event, so only popstate is observed. */
function subscribeToLocation(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

/** Tailwind text color for a percent change: green up, red down, gray flat. */
const pctColorClass = (pct: number | null) =>
  pct == null
    ? "text-neutral-500"
    : pct > 0
      ? "text-green-600"
      : pct < 0
        ? "text-red-600"
        : "text-neutral-500";

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
  const [submittedAt] = useState(initialSubmittedAt);
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
    () =>
      ordinalColorScale(Array.from(new Set(lineItems.map((d) => d.category)))),
    [lineItems],
  );

  // Collapsed by default so the written report leads; opened on print so the
  // chart is never silently dropped from a PDF.
  const [chartOpen, setChartOpen] = useState(true);
  useEffect(() => {
    const before = () => setChartOpen(true);
    window.addEventListener("beforeprint", before);
    return () => window.removeEventListener("beforeprint", before);
  }, []);

  // The share URL is external (browser) state, so it is read through a store
  // rather than an effect+setState: empty on the server, the real location
  // once mounted, which also avoids a hydration mismatch.
  const shareUrl = useSyncExternalStore(
    subscribeToLocation,
    getCleanLocation,
    () => "",
  );

  // Strip the ?submitted=1 marker after it has been read, so the copied/shared
  // URL is always clean and a reload doesn't re-show the confirmation banner.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("submitted")) return;
    url.searchParams.delete("submitted");
    window.history.replaceState(null, "", url.toString());
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
  const increased = changed.filter((d) => d.amount > d.baselineAmount);
  const decreased = changed.filter((d) => d.amount < d.baselineAmount);

  return (
    <div className="pt-4 pb-12">
      {/* Toolbar — hidden when printing. */}
      {!readOnly && (
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href={`/budget/${uuid}/edit`} className="text-sm text-blue-600">
            ← Back to editing
          </Link>
          <button type="button" onClick={submit} className="btn-primary">
            Submit budget
          </button>
        </div>
      )}

      {readOnly && submittedAt && justSubmitted && (
        <p className="no-print mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-[0.9rem] py-[0.6rem] text-[0.85rem] text-emerald-800">
          ✓ Submitted {new Date(submittedAt).toLocaleString()}. Share this page:{" "}
          <span className="font-semibold">{shareUrl}</span>
        </p>
      )}

      <div className="flex">
        <div className="w-3/4">
          {/* Share / print actions float in the bottom corner, to the left of the
          global Feedback button (fixed at right/bottom 1.25rem, z-index 50). */}
          <div className="no-print fixed right-[10.5rem] bottom-5 z-50 flex items-center gap-2">
            <button type="button" onClick={copyLink} className="btn-floating">
              {copied ? "Link copied!" : "Copy share link"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-floating"
            >
              Print / PDF
            </button>
          </div>

          <EditableText
            value={name}
            placeholder="Your mayoral or project name"
            as="h1"
            readOnly={readOnly}
            className="my-1 text-[2rem]"
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
            className="mt-0 mb-4 text-xl text-neutral-700 italic"
            onCommit={(v) => {
              setTagline(v);
              commitIntro({ tagline: v });
            }}
          />
          {/* Additional information (hidden in the final view when empty) */}
          {(!readOnly || info) && (
            <section className="mb-6">
              <EditableText
                value={info}
                placeholder="Add context or further explanation for your budget (optional)…"
                as="textarea"
                readOnly={readOnly}
                className="text-[0.95rem] leading-relaxed text-neutral-800"
                onCommit={(v) => {
                  setInfo(v);
                  commitIntro({ additionalInfo: v });
                }}
              />
            </section>
          )}
        </div>
        <div className="ml-4 w-1/4">
          <div
            className="rounded-b border-1 border-t-2 border-neutral-200 px-4 py-3"
            role="alert"
          >
            <div className="flex">
              <div className="py-1">
                <svg
                  className="mr-4 h-6 w-6 fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                >
                  <path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z" />
                </svg>
              </div>
              <div>
                <p className="py-1">
                  This document represents a proposed budget for the General
                  Fund for FY
                  {fiscalYear}.
                </p>
                <p className="py-1">
                  The General Fund for FY{fiscalYear.slice(-2)} was{" "}
                  <strong>{dollars.format(totalToSpend)}</strong>.
                </p>
                <p className="py-1">
                  This proposed budget includes{" "}
                  <strong
                    className={
                      remaining < 0
                        ? "text-red-600"
                        : remaining > 0
                          ? "text-blue-600"
                          : "text-green-600"
                    }
                  >
                    {remaining === 0
                      ? "every dollar allocated"
                      : `${dollars.format(Math.abs(remaining))} ${
                          remaining < 0 ? "over budget" : "unallocated"
                        }`}
                  </strong>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Budget visualization (collapsible, +/- view only) ---- */}
      <section className="my-6">
        <details
          open={chartOpen}
          onToggle={(e) => setChartOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-xl border border-neutral-200 px-4 py-3"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[0.95rem] font-semibold">
            <span aria-hidden className="text-xs text-neutral-500">
              {chartOpen ? "▼" : "▶"}
            </span>
            Budget visualization
            <span className="text-[0.85rem] font-normal text-neutral-500">
              — funding change vs. FY2026
            </span>
          </summary>

          <div className="mt-4">
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
      <section className="mb-6 rounded-xl border border-neutral-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-[1.15rem] font-bold">
            What this budget delivers
          </h2>
          {changed.length > 0 && (
            <p className="m-0 text-xs text-neutral-500">
              {increased.length > 0 && (
                <span className="font-semibold text-green-700">
                  {increased.length} increased
                </span>
              )}
              {increased.length > 0 && decreased.length > 0 && " · "}
              {decreased.length > 0 && (
                <span className="font-semibold text-red-700">
                  {decreased.length} decreased
                </span>
              )}
            </p>
          )}
        </div>
        {changed.length === 0 ? (
          <p className="text-[0.95rem] text-neutral-500">
            No funding changes yet — adjust a department to describe what your
            budget will deliver.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {changed.map((d) => {
              const list = outcomesByDept.get(d.name) ?? [];
              // The delta is measured against the baseline the user started
              // from, so it reflects their own decision — not the automatic
              // year-over-year raise every department already received.
              const delta = d.amount - d.baselineAmount;
              const deltaPct =
                d.baselineAmount > 0 ? (delta / d.baselineAmount) * 100 : null;
              const up = delta > 0;
              return (
                <li
                  key={d.name}
                  className={`flex flex-col gap-2 rounded-lg border border-l-4 bg-white p-3 ${
                    up
                      ? "border-green-100 border-l-green-500"
                      : "border-red-100 border-l-red-500"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[0.95rem] leading-tight font-bold">
                      {d.name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${
                        up
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {up ? "+" : "−"}
                      {compactDollars(delta)}
                      {deltaPct != null && (
                        <span className="font-semibold opacity-75">
                          {" "}
                          ({signedPct(deltaPct)})
                        </span>
                      )}
                    </span>
                  </div>

                  {list.length > 0 && (
                    <ul className="m-0 grid list-none gap-1 p-0">
                      {list.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-start gap-1.5 text-[0.85rem] leading-snug text-gray-700"
                        >
                          <span aria-hidden className="text-blue-600">
                            →
                          </span>
                          <span className="flex-1">{o.description}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              className="no-print shrink-0 cursor-pointer border-0 bg-transparent leading-none text-neutral-400"
                              onClick={() => removeOutcome(o.id)}
                              aria-label="Delete outcome"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {list.length === 0 && !readOnly && (
                    <p className="no-print m-0 text-xs text-red-600">
                      Add an outcome to describe what this change delivers.
                    </p>
                  )}

                  {!readOnly && (
                    <div className="no-print mt-auto">
                      <OutcomeAdder
                        onAdd={(text) => addOutcome(d.name, text)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Funding changes — the money view, without outcomes 
      <section className="mb-6">
        <h2 className="section-heading">Funding changes ({changed.length})</h2>
        {changed.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No departments changed from the baseline yet.
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-[0.4rem] p-0">
            {changed.map((d) => (
              <li
                key={d.name}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-neutral-200 px-3 py-2"
              >
                <span className="font-semibold">{d.name}</span>
                <span className="whitespace-nowrap">
                  {dollars.format(d.amount)}{" "}
                  <span
                    className={`font-semibold ${pctColorClass(d.percentChange)}`}
                  >
                    ({signedPct(d.percentChange as number)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      */}
      {/* Full budget table */}
      <section>
        <h2 className="section-heading">Full General Fund budget</h2>
        <table className="budget-table w-full border-collapse text-[0.85rem]">
          <thead>
            <tr className="text-left text-neutral-500">
              <th>Department</th>
              <th className="text-right">Amount</th>
              <th className="text-right">vs. FY2026</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((d) => (
              <tr key={d.name} className="border-t border-neutral-100">
                <td>
                  {d.name}
                  <span className="ml-[0.4rem] text-xs text-neutral-400">
                    {d.category}
                  </span>
                </td>
                <td className="text-right">{dollars.format(d.amount)}</td>
                <td
                  className={`text-right font-semibold ${pctColorClass(
                    d.percentChange,
                  )}`}
                >
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

/**
 * Legend for the +/- coloring: a red→pale→green ramp matching Treemap's
 * diverging change scale (clamped at ±20%).
 */
function ChangeKey() {
  return (
    <div className="mb-3 flex items-center gap-[0.6rem] text-xs text-neutral-600">
      <span>−20% or less</span>
      <div
        aria-hidden
        className="change-key-ramp h-[0.6rem] flex-1 rounded-full border border-neutral-200"
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
    <div className="flex gap-[0.4rem]">
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
        className="flex-1 rounded-md border border-neutral-300 px-2 py-[0.35rem] text-[0.85rem]"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!text.trim()}
        className={`btn-secondary px-[0.7rem] py-[0.35rem] text-xs ${
          text.trim() ? "opacity-100" : "opacity-50"
        }`}
      >
        Add
      </button>
    </div>
  );
}
