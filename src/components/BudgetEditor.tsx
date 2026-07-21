"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Treemap, { type TreemapDatum } from "@/src/components/Treemap";
import { ordinalColorScale } from "@/src/lib/colors";

export interface EditorDepartment {
  name: string;
  category: string;
  priorAmount: number;
}

export interface OutcomeItem {
  id: string;
  department: string;
  description: string;
}

interface BudgetEditorProps {
  uuid: string;
  totalToSpend: number;
  departments: EditorDepartment[];
  /** Persisted allocations (dept name -> amount); empty on a fresh budget. */
  savedAllocations: Record<string, number>;
  /** The user's saved mayoral / project name; empty until they set it. */
  savedName: string;
  /** What the budget delivers; empty until they set it. */
  savedTagline: string;
  baselineRaise: number;
  /** Outcomes already saved for this budget. */
  initialOutcomes: OutcomeItem[];
  /** Server action to persist allocations. */
  onSave: (
    uuid: string,
    allocations: Record<string, number>,
  ) => Promise<void>;
  /** Server action to save the intro fields (name and/or tagline). */
  onSaveIntro: (
    uuid: string,
    fields: { name?: string; tagline?: string },
  ) => Promise<void>;
  /** Server action to add an outcome; resolves to the created row. */
  onAddOutcome: (
    uuid: string,
    department: string,
    description: string,
  ) => Promise<OutcomeItem | null>;
  /** Server action to delete an outcome by id. */
  onDeleteOutcome: (uuid: string, outcomeId: string) => Promise<void>;
}

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const signedPct = (pct: number) =>
  `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

const pctTextColor = (pct: number | null) =>
  pct == null ? "#666" : pct > 0 ? "#16a34a" : pct < 0 ? "#dc2626" : "#666";

const adjustButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  border: "1px solid #d4d4d4",
  borderRadius: "0.375rem",
  background: "#f9f9f9",
  color: "#333",
  cursor: "pointer",
};

const categoryChipStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.3rem 0.6rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  borderRadius: "999px",
  border: `1px solid ${active ? "#2563eb" : "#d4d4d4"}`,
  background: active ? "#eff6ff" : "#fff",
  color: active ? "#2563eb" : "#444",
  cursor: "pointer",
});

interface DepartmentRowProps {
  name: string;
  category: string;
  color: string;
  value: number;
  pct: number | null;
  zebra: boolean;
  outcomeCount: number;
  onOpen: () => void;
}

/** A department row: clicking anywhere opens the edit dialog. */
function DepartmentRow({
  name,
  category,
  color,
  value,
  pct,
  zebra,
  outcomeCount,
  onOpen,
}: DepartmentRowProps) {
  return (
    <li style={{ borderTop: "1px solid #f0f0f0" }}>
      <button
        type="button"
        onClick={onOpen}
        title={`Edit ${name}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%",
          padding: "0.6rem 0.75rem",
          background: zebra ? "#fafafa" : "#fff",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            borderRadius: 3,
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{name}</span>
          <span
            style={{ color: "#999", fontSize: "0.75rem", marginLeft: "0.5rem" }}
          >
            {category}
          </span>
          {outcomeCount > 0 && (
            <span
              title={`${outcomeCount} outcome${outcomeCount === 1 ? "" : "s"}`}
              style={{
                marginLeft: "0.5rem",
                padding: "0.05rem 0.4rem",
                fontSize: "0.7rem",
                fontWeight: 600,
                color: "#2563eb",
                background: "#eff6ff",
                borderRadius: "999px",
                verticalAlign: "middle",
              }}
            >
              {outcomeCount} outcome{outcomeCount === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <span
          style={{
            width: "4.5rem",
            textAlign: "right",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: pctTextColor(pct),
          }}
        >
          {pct == null ? "—" : signedPct(pct)}
        </span>
        <span
          style={{
            width: "9rem",
            textAlign: "right",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {dollars.format(value)}
        </span>
      </button>
    </li>
  );
}

export default function BudgetEditor({
  uuid,
  totalToSpend,
  departments,
  savedAllocations,
  savedName,
  savedTagline,
  baselineRaise,
  initialOutcomes,
  onSave,
  onSaveIntro,
  onAddOutcome,
  onDeleteOutcome,
}: BudgetEditorProps) {
  // Starting allocation per department: prior year * (1 + baseline raise),
  // unless the saved budget already has an edited amount.
  const baseline = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of departments) {
      map[d.name] = Math.round(d.priorAmount * (1 + baselineRaise));
    }
    return map;
  }, [departments, baselineRaise]);

  // Funds left after the uniform baseline raise is applied to every department
  // (shown in the welcome copy before any editing).
  const baselineRemaining = useMemo(
    () =>
      totalToSpend -
      Object.values(baseline).reduce((s, v) => s + v, 0),
    [totalToSpend, baseline],
  );

  const [allocations, setAllocations] = useState<Record<string, number>>(
    () => ({ ...baseline, ...savedAllocations }),
  );
  const [editing, setEditing] = useState<EditorDepartment | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  // List UI state: the "All departments" section is a single accordion that
  // starts closed, plus an active category filter (null = show all).
  // Filtering the list does NOT affect the chart.
  const [listOpen, setListOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [outcomes, setOutcomes] = useState<OutcomeItem[]>(initialOutcomes);

  // Outcomes grouped by department for quick lookup (badge + modal list).
  const outcomesByDept = useMemo(() => {
    const map = new Map<string, OutcomeItem[]>();
    for (const o of outcomes) {
      const list = map.get(o.department) ?? [];
      list.push(o);
      map.set(o.department, list);
    }
    return map;
  }, [outcomes]);

  const addOutcome = (department: string, description: string) => {
    const text = description.trim();
    if (!text) return;
    // Optimistic: show immediately with a temporary id, reconcile on save.
    const tempId = `temp-${department}-${outcomes.length}-${text.length}`;
    const optimistic: OutcomeItem = { id: tempId, department, description: text };
    setOutcomes((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const saved = await onAddOutcome(uuid, department, text);
      if (saved) {
        setOutcomes((prev) =>
          prev.map((o) => (o.id === tempId ? saved : o)),
        );
      } else {
        setOutcomes((prev) => prev.filter((o) => o.id !== tempId));
      }
    });
  };

  const removeOutcome = (id: string) => {
    setOutcomes((prev) => prev.filter((o) => o.id !== id));
    startTransition(() => onDeleteOutcome(uuid, id));
  };

  // Multi-step welcome. Steps 1 (name) and 2 (tagline) collect + persist input;
  // steps 3–6 are informational onboarding. `started` = the chart is shown.
  // A returning user (name + tagline already saved) skips the whole flow.
  const WELCOME_STEPS = 6;
  const [name, setName] = useState(savedName);
  const [tagline, setTagline] = useState(savedTagline);
  const [started, setStarted] = useState(Boolean(savedName && savedTagline));
  const [step, setStep] = useState(savedName ? 2 : 1);
  const [nameDraft, setNameDraft] = useState(savedName);
  const [taglineDraft, setTaglineDraft] = useState(savedTagline);

  const submitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setName(trimmed);
    setStep(2);
    startTransition(() => onSaveIntro(uuid, { name: trimmed }));
  };

  const submitTagline = () => {
    const trimmed = taglineDraft.trim();
    if (!trimmed) return;
    setTagline(trimmed);
    setStep(3); // continue to the informational steps
    startTransition(() => onSaveIntro(uuid, { tagline: trimmed }));
  };

  // Advance through the informational steps; the last one reveals the chart.
  const nextStep = () => {
    if (step >= WELCOME_STEPS) setStarted(true);
    else setStep((s) => s + 1);
  };

  const priorByName = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of departments) map[d.name] = d.priorAmount;
    return map;
  }, [departments]);

  // Stable color per People's Budget category (shared with the explore view).
  const categoryColor = useMemo(() => {
    const names = Array.from(new Set(departments.map((d) => d.category)));
    return ordinalColorScale(names);
  }, [departments]);

  // Distinct categories (sorted) for the list's category key.
  const categories = useMemo(
    () =>
      Array.from(new Set(departments.map((d) => d.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [departments],
  );

  // Departments shown in the list, filtered by the active category (if any).
  const visibleDepartments = useMemo(
    () =>
      categoryFilter
        ? departments.filter((d) => d.category === categoryFilter)
        : departments,
    [departments, categoryFilter],
  );

  // Treemap data: value = current allocation, % change = vs. prior year (2026).
  const data: TreemapDatum[] = useMemo(
    () =>
      departments.map((d) => {
        const value = allocations[d.name] ?? baseline[d.name];
        const prior = d.priorAmount;
        return {
          name: d.name,
          value,
          category: d.category,
          percentChange:
            prior > 0 ? ((value - prior) / prior) * 100 : null,
        };
      }),
    [departments, allocations, baseline],
  );

  const totalSpent = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + v, 0),
    [allocations],
  );
  const remaining = totalToSpend - totalSpent;

  const openEditor = (deptName: string) => {
    const dept = departments.find((d) => d.name === deptName);
    if (!dept) return;
    setEditing(dept);
    setDraft(String(allocations[dept.name] ?? baseline[dept.name]));
  };

  // Update one department's allocation and persist. Shared by the modal and
  // the editable list below the chart.
  const commitAllocation = (name: string, rawAmount: number) => {
    const amount = Math.max(0, Math.round(rawAmount || 0));
    const next = { ...allocations, [name]: amount };
    setAllocations(next);
    startTransition(() => onSave(uuid, next));
  };

  // Does the modal's draft change the department's currently-saved amount?
  const editingChanged = editing
    ? Math.round(Number(draft) || 0) !==
      (allocations[editing.name] ?? baseline[editing.name])
    : false;
  // An outcome is required to save a funding change.
  const editingHasOutcome = editing
    ? (outcomesByDept.get(editing.name)?.length ?? 0) > 0
    : false;
  const editingNeedsOutcome = editingChanged && !editingHasOutcome;

  const applyEdit = () => {
    if (!editing || editingNeedsOutcome) return;
    commitAllocation(editing.name, Number(draft));
    setEditing(null);
  };

  const editingPrior = editing ? priorByName[editing.name] : 0;
  const editingPct =
    editing && editingPrior > 0
      ? ((Number(draft) || 0) - editingPrior) / editingPrior * 100
      : null;

  // Scale the draft amount by a factor (e.g. 1.05 for +5%, 0.9 for -10%).
  const adjustDraft = (factor: number) => {
    const current = Math.max(0, Number(draft) || 0);
    setDraft(String(Math.round(current * factor)));
  };

  // Funds left over if this department kept its currently *saved* amount.
  // Setting the draft to draft + this value allocates every remaining dollar
  // to this department (driving the running total to exactly the budget).
  const remainingForEditing = editing
    ? totalToSpend - (totalSpent - (allocations[editing.name] ?? 0))
    : 0;
  const allocateAllRemaining = () => {
    setDraft(String(Math.max(0, Math.round(remainingForEditing))));
  };

  // Welcome flow — the chart stays hidden until both steps are complete.
  if (!started) {
    const nextButton = (onClick: () => void, enabled: boolean) => (
      <button
        type="button"
        onClick={onClick}
        disabled={!enabled}
        style={{
          padding: "0.6rem 1.25rem",
          fontSize: "1rem",
          fontWeight: 600,
          border: "none",
          borderRadius: "0.5rem",
          background: "#2563eb",
          color: "#fff",
          cursor: enabled ? "pointer" : "not-allowed",
          opacity: enabled ? 1 : 0.5,
        }}
      >
        Next
      </button>
    );

    return (
      <div className="hero" style={{ maxWidth: "36rem", padding: "1rem 0" }}>
        <p className="eyebrow">City of Philadelphia</p>

        {step === 1 ? (
          <>
            <h1>Welcome</h1>
            <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
              This is your chance to propose Philly&rsquo;s budget. This tool
              imagines you have the power of the mayor to propose how Philly
              will spend the General Fund, the discretionary part of
              Philly&rsquo;s money.
            </p>
            <p
              className="lede"
              style={{
                fontSize: "1rem",
                lineHeight: 1.6,
                marginTop: "0.75rem",
              }}
            >
              You have <strong>{dollars.format(totalToSpend)}</strong> for
              fiscal year 2027, which started July 1, 2026.
            </p>

            <label
              htmlFor="mayoral-name"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.9rem",
                margin: "1.5rem 0 0.4rem",
              }}
            >
              What is your mayoral or project name?
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="mayoral-name"
                type="text"
                value={nameDraft}
                autoFocus
                placeholder="e.g. Mayor Smith's Plan"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitName();
                }}
                style={{
                  flex: 1,
                  padding: "0.6rem 0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #d4d4d4",
                  borderRadius: "0.5rem",
                }}
              />
              {nextButton(submitName, Boolean(nameDraft.trim()))}
            </div>
          </>
        ) : step === 2 ? (
          <>
            <h1>{name}</h1>
            <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
              Philly&rsquo;s budget is a moral document, a fiscal opus, a call
              to arms, and a promise to our future selves.
            </p>

            <label
              htmlFor="budget-tagline"
              style={{
                display: "block",
                fontWeight: 600,
                fontSize: "0.9rem",
                margin: "1.5rem 0 0.4rem",
              }}
            >
              What does your budget deliver?
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                id="budget-tagline"
                type="text"
                value={taglineDraft}
                autoFocus
                placeholder="e.g. Clean & Green"
                onChange={(e) => setTaglineDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitTagline();
                }}
                style={{
                  flex: 1,
                  padding: "0.6rem 0.75rem",
                  fontSize: "1rem",
                  border: "1px solid #d4d4d4",
                  borderRadius: "0.5rem",
                }}
              />
              {nextButton(submitTagline, Boolean(taglineDraft.trim()))}
            </div>
            <p
              style={{
                fontSize: "0.8rem",
                color: "#888",
                lineHeight: 1.6,
                marginTop: "0.75rem",
              }}
            >
              Parker had &ldquo;Clean &amp; Green&rdquo; and &ldquo;One
              Philly,&rdquo; Roosevelt had &ldquo;A chicken in every pot and
              prosperity,&rdquo; Rizzo had &ldquo;I&rsquo;m an awful
              person.&rdquo;
            </p>
          </>
        ) : (
          <>
            <h1>{step === 6 ? "WAIT…" : name}</h1>
            {step === 3 && (
              <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
                {name}, you have{" "}
                <strong>{dollars.format(totalToSpend)}</strong> to spend, which
                is the same as Parker&rsquo;s proposed 2027 budget. This is a
                1.8% increase above FY2026. That has been applied to all of the
                departments, with{" "}
                <strong>{dollars.format(baselineRemaining)}</strong> left over
                to allocate. Click on a department to add or remove funds.
              </p>
            )}
            {step === 4 && (
              <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
                Each of your decisions has outcomes. When you add or remove
                funding, you need to include those.
              </p>
            )}
            {step === 5 && (
              <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
                Once you are done, you can review your budget before it is set
                in PDF.
              </p>
            )}
            {step === 6 && (
              <p className="lede" style={{ fontSize: "1rem", lineHeight: 1.6 }}>
                Can&rsquo;t a mayor propose new funds? Yes, that functionality
                will be added soon.
              </p>
            )}
            <div style={{ marginTop: "1.5rem" }}>
              {nextButton(nextStep, true)}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="hero" style={{ marginBottom: "1.5rem" }}>
        <p className="eyebrow">City of Philadelphia{name ? ` · ${name}` : ""}</p>
        <h1>Make your own budget</h1>
        {tagline && (
          <p
            className="lede"
            style={{
              fontStyle: "italic",
              color: "#555",
              margin: "0.25rem 0 0.5rem",
            }}
          >
            “{tagline}”
          </p>
        )}
        <p className="lede" style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          You have {dollars.format(totalToSpend)} to spend through the General
          Fund.
        </p>
        <p
          className="lede"
          style={{
            fontWeight: 600,
            color: remaining < 0 ? "#dc2626" : remaining > 0 ? "#2563eb" : "#16a34a",
          }}
        >
          {remaining === 0
            ? "Balanced — every dollar allocated."
            : remaining > 0
              ? `${dollars.format(remaining)} remaining to allocate.`
              : `${dollars.format(-remaining)} over budget.`}{" "}
          <span style={{ color: "#888", fontWeight: 400 }}>
            (allocated {dollars.format(totalSpent)})
          </span>
        </p>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "0.75rem",
        }}
      >
        <Link
          href={`/budget/${uuid}/review`}
          style={{
            padding: "0.55rem 1.1rem",
            fontSize: "0.9rem",
            fontWeight: 600,
            borderRadius: "0.5rem",
            background: "#2563eb",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Review &amp; submit →
        </Link>
      </div>

      <Treemap
        data={data}
        view={"fund"}
        valuePrefix="$"
        categoryColor={categoryColor}
        forceColorMode="change"
        hideKey
        onTileClick={(datum) => openEditor(datum.name)}
      />

      <section style={{ marginTop: "2rem" }}>
        {/* The whole section is an accordion, closed by default. */}
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-expanded={listOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            width: "100%",
            padding: "0.5rem 0",
            background: "none",
            border: "none",
            borderBottom: "1px solid #e5e5e5",
            cursor: "pointer",
            font: "inherit",
            textAlign: "left",
          }}
        >
          <span
            aria-hidden
            style={{
              transform: listOpen ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
              color: "#999",
              fontSize: "0.8rem",
            }}
          >
            ▶
          </span>
          <span style={{ fontSize: "1rem", fontWeight: 600 }}>
            All departments
          </span>
          <span style={{ color: "#999", fontSize: "0.8rem" }}>
            ({departments.length})
          </span>
        </button>

        {listOpen && (
          <div style={{ marginTop: "0.75rem" }}>
            {/* Category key — click to filter the list (chart is unaffected). */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.4rem",
                marginBottom: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                aria-pressed={categoryFilter === null}
                style={categoryChipStyle(categoryFilter === null)}
              >
                All ({departments.length})
              </button>
              {categories.map((cat) => {
                const count = departments.filter(
                  (d) => d.category === cat,
                ).length;
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(active ? null : cat)}
                    aria-pressed={active}
                    style={categoryChipStyle(active)}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: categoryColor(cat),
                        display: "inline-block",
                        marginRight: "0.4rem",
                        verticalAlign: "middle",
                      }}
                    />
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                border: "1px solid #e5e5e5",
                borderRadius: "0.5rem",
                overflow: "hidden",
              }}
            >
              {visibleDepartments.map((d, i) => {
                const value = allocations[d.name] ?? baseline[d.name];
                const pct =
                  d.priorAmount > 0
                    ? ((value - d.priorAmount) / d.priorAmount) * 100
                    : null;
                return (
                  <DepartmentRow
                    key={d.name}
                    name={d.name}
                    category={d.category}
                    color={categoryColor(d.category)}
                    value={value}
                    pct={pct}
                    zebra={i % 2 === 1}
                    outcomeCount={(outcomesByDept.get(d.name) ?? []).length}
                    onOpen={() => openEditor(d.name)}
                  />
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {outcomes.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
            Your outcomes
          </h2>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gap: "0.5rem",
            }}
          >
            {outcomes.map((o) => (
              <li
                key={o.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.625rem 0.75rem",
                  border: "1px solid #eee",
                  borderRadius: "0.375rem",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    marginTop: 4,
                    background: categoryColor(
                      priorByName[o.department] !== undefined
                        ? departments.find((d) => d.name === o.department)
                            ?.category ?? ""
                        : "",
                    ),
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                    {o.department}
                  </span>
                  <span
                    style={{
                      display: "block",
                      color: "#444",
                      fontSize: "0.85rem",
                      marginTop: "0.15rem",
                    }}
                  >
                    {o.description}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeOutcome(o.id)}
                  aria-label={`Delete outcome for ${o.department}`}
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
        </section>
      )}

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit ${editing.name}`}
          onClick={() => setEditing(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              width: "min(28rem, 90vw)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
            }}
          >
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "1.125rem" }}>
              {editing.name}
            </h2>
            <p
              style={{
                margin: "0 0 1rem",
                fontSize: "0.8rem",
                color: "#666",
              }}
            >
              {editing.category} · last year{" "}
              {dollars.format(editingPrior)}
            </p>

            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.35rem",
              }}
            >
              Amount allocated
            </label>
            <input
              type="number"
              min={0}
              step={1000000}
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyEdit();
                if (e.key === "Escape") setEditing(null);
              }}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #d4d4d4",
                borderRadius: "0.5rem",
                boxSizing: "border-box",
              }}
            />
            {editingPct != null && (
              <p
                style={{
                  margin: "0.5rem 0 0",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  color:
                    editingPct > 0
                      ? "#16a34a"
                      : editingPct < 0
                        ? "#dc2626"
                        : "#666",
                }}
              >
                {signedPct(editingPct)} vs. last year
              </p>
            )}

            {/* Quick adjustments relative to the current amount. */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.4rem",
                marginTop: "1rem",
              }}
            >
              {[
                { label: "+5%", factor: 1.05 },
                { label: "+10%", factor: 1.1 },
                { label: "+20%", factor: 1.2 },
                { label: "−5%", factor: 0.95 },
                { label: "−10%", factor: 0.9 },
                { label: "−20%", factor: 0.8 },
              ].map(({ label, factor }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => adjustDraft(factor)}
                  style={adjustButtonStyle}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={allocateAllRemaining}
              disabled={remainingForEditing < 0}
              title={
                remainingForEditing < 0
                  ? "Already over budget"
                  : "Set this department to use all unallocated funds"
              }
              style={{
                ...adjustButtonStyle,
                width: "100%",
                marginTop: "0.4rem",
                fontWeight: 600,
                opacity: remainingForEditing < 0 ? 0.5 : 1,
                cursor: remainingForEditing < 0 ? "not-allowed" : "pointer",
              }}
            >
              Allocate all remaining funds
              {remainingForEditing >= 0
                ? ` (${dollars.format(remainingForEditing)})`
                : ""}
            </button>

            <OutcomesEditor
              outcomes={outcomesByDept.get(editing.name) ?? []}
              onAdd={(text) => addOutcome(editing.name, text)}
              onDelete={removeOutcome}
              required={editingNeedsOutcome}
            />

            {editingNeedsOutcome && (
              <p
                role="alert"
                style={{
                  margin: "0.5rem 0 0",
                  fontSize: "0.8rem",
                  color: "#dc2626",
                  fontWeight: 600,
                }}
              >
                Add an outcome to explain this funding change before saving.
              </p>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "1.25rem",
              }}
            >
              <button
                type="button"
                onClick={() => setEditing(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d4d4d4",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyEdit}
                disabled={editingNeedsOutcome}
                title={
                  editingNeedsOutcome
                    ? "Add an outcome before saving this change"
                    : undefined
                }
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: editingNeedsOutcome ? "not-allowed" : "pointer",
                  opacity: editingNeedsOutcome ? 0.5 : 1,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#888",
            textAlign: "center",
            marginTop: "0.5rem",
          }}
        >
          Saving…
        </p>
      )}
    </div>
  );
}

interface OutcomesEditorProps {
  outcomes: OutcomeItem[];
  onAdd: (description: string) => void;
  onDelete: (id: string) => void;
  required?: boolean;
}

/** Outcomes section inside the edit modal: existing list + add form. */
function OutcomesEditor({
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
