"use client";

import { useMemo, useState, useTransition } from "react";
import type { TreemapDatum } from "@/src/components/Treemap";
import { ordinalColorScale } from "@/src/lib/colors";
import WelcomeFlow from "@/src/components/budget/WelcomeFlow";
import EditorView from "@/src/components/budget/EditorView";
import EditDeptModal from "@/src/components/budget/EditDeptModal";
import type { EditorDepartment, OutcomeItem } from "@/src/lib/budget-format";

// Re-exported for existing importers (e.g. BudgetReview, edit page).
export type { EditorDepartment, OutcomeItem };

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
  onSave: (uuid: string, allocations: Record<string, number>) => Promise<void>;
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
    () => totalToSpend - Object.values(baseline).reduce((s, v) => s + v, 0),
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
    const optimistic: OutcomeItem = {
      id: tempId,
      department,
      description: text,
    };
    setOutcomes((prev) => [...prev, optimistic]);
    startTransition(async () => {
      const saved = await onAddOutcome(uuid, department, text);
      if (saved) {
        setOutcomes((prev) => prev.map((o) => (o.id === tempId ? saved : o)));
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
          percentChange: prior > 0 ? ((value - prior) / prior) * 100 : null,
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
      ? (((Number(draft) || 0) - editingPrior) / editingPrior) * 100
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

  const help = (
    <>
      Click on a department in the chart, or list of departments below to add or
      remove funds.{" "}
    </>
  );

  // Welcome flow — the chart stays hidden until the flow is complete.
  if (!started) {
    return (
      <WelcomeFlow
        step={step}
        name={name}
        totalToSpend={totalToSpend}
        baselineRemaining={baselineRemaining}
        nameDraft={nameDraft}
        taglineDraft={taglineDraft}
        onNameDraftChange={setNameDraft}
        onTaglineDraftChange={setTaglineDraft}
        onSubmitName={submitName}
        onSubmitTagline={submitTagline}
        onNext={nextStep}
      />
    );
  }

  return (
    <>
      <EditorView
        uuid={uuid}
        name={name}
        tagline={tagline}
        totalToSpend={totalToSpend}
        totalSpent={totalSpent}
        remaining={remaining}
        help={help}
        data={data}
        categoryColor={categoryColor}
        onTileClick={openEditor}
        departments={departments}
        visibleDepartments={visibleDepartments}
        categories={categories}
        allocations={allocations}
        baseline={baseline}
        outcomeCountByDept={(depName) =>
          (outcomesByDept.get(depName) ?? []).length
        }
        listOpen={listOpen}
        onToggleList={() => setListOpen((o) => !o)}
        categoryFilter={categoryFilter}
        onFilterChange={setCategoryFilter}
        onOpenDept={openEditor}
        outcomes={outcomes}
        priorByName={priorByName}
        onDeleteOutcome={removeOutcome}
      />

      {editing && (
        <EditDeptModal
          editing={editing}
          draft={draft}
          editingPrior={editingPrior}
          editingPct={editingPct}
          remainingForEditing={remainingForEditing}
          outcomes={outcomesByDept.get(editing.name) ?? []}
          editingNeedsOutcome={editingNeedsOutcome}
          onDraftChange={setDraft}
          onAdjust={adjustDraft}
          onAllocateAllRemaining={allocateAllRemaining}
          onAddOutcome={(text) => addOutcome(editing.name, text)}
          onDeleteOutcome={removeOutcome}
          onSave={applyEdit}
          onClose={() => setEditing(null)}
        />
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
    </>
  );
}
