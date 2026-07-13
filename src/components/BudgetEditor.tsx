"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Treemap, { type TreemapDatum } from "@/src/components/Treemap";
import { ordinalColorScale } from "@/src/lib/colors";

export interface EditorDepartment {
  name: string;
  category: string;
  priorAmount: number;
}

interface BudgetEditorProps {
  uuid: string;
  totalToSpend: number;
  departments: EditorDepartment[];
  /** Persisted allocations (dept name -> amount); empty on a fresh budget. */
  savedAllocations: Record<string, number>;
  baselineRaise: number;
  /** Server action to persist allocations. */
  onSave: (
    uuid: string,
    allocations: Record<string, number>,
  ) => Promise<void>;
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

interface DepartmentRowProps {
  name: string;
  category: string;
  color: string;
  value: number;
  pct: number | null;
  zebra: boolean;
  onCommit: (amount: number) => void;
}

/** One editable department row: inline amount input, commits on blur/Enter. */
function DepartmentRow({
  name,
  category,
  color,
  value,
  pct,
  zebra,
  onCommit,
}: DepartmentRowProps) {
  const [draft, setDraft] = useState(String(value));

  // Keep the input in sync when the value changes elsewhere (e.g. the modal).
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const amount = Number(draft);
    if (Number.isFinite(amount) && Math.round(amount) !== value) {
      onCommit(amount);
    } else {
      setDraft(String(value)); // revert invalid input
    }
  };

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.5rem 0.75rem",
        borderTop: zebra ? "1px solid #f0f0f0" : "1px solid #f0f0f0",
        background: zebra ? "#fafafa" : "#fff",
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
      <span style={{ color: "#888", fontSize: "0.9rem" }}>$</span>
      <input
        type="number"
        min={0}
        step={1000000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(String(value));
        }}
        aria-label={`Amount for ${name}`}
        style={{
          width: "9rem",
          padding: "0.35rem 0.5rem",
          fontSize: "0.85rem",
          textAlign: "right",
          border: "1px solid #d4d4d4",
          borderRadius: "0.375rem",
        }}
      />
    </li>
  );
}

export default function BudgetEditor({
  uuid,
  totalToSpend,
  departments,
  savedAllocations,
  baselineRaise,
  onSave,
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

  const [allocations, setAllocations] = useState<Record<string, number>>(
    () => ({ ...baseline, ...savedAllocations }),
  );
  const [editing, setEditing] = useState<EditorDepartment | null>(null);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

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

  const openEditor = (datum: TreemapDatum) => {
    const dept = departments.find((d) => d.name === datum.name);
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

  const applyEdit = () => {
    if (!editing) return;
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

  return (
    <div>
      <div className="hero" style={{ marginBottom: "1.5rem" }}>
        <p className="eyebrow">City of Philadelphia</p>
        <h1>Make your own budget</h1>
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

      <Treemap
        data={data}
        valuePrefix="$"
        categoryColor={categoryColor}
        forceColorMode="change"
        hideKey
        onTileClick={openEditor}
      />

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1rem", margin: "0 0 0.75rem" }}>
          All departments
        </h2>
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
          {departments.map((d, i) => {
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
                onCommit={(amount) => commitAllocation(d.name, amount)}
              />
            );
          })}
        </ul>
      </section>

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
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
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
