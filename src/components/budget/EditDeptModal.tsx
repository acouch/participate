"use client";

import OutcomesEditor from "@/src/components/budget/OutcomesEditor";
import {
  adjustButtonStyle,
  dollars,
  signedPct,
  type EditorDepartment,
  type OutcomeItem,
} from "@/src/lib/budget-format";

interface EditDeptModalProps {
  editing: EditorDepartment;
  draft: string;
  editingPrior: number;
  editingPct: number | null;
  remainingForEditing: number;
  outcomes: OutcomeItem[];
  editingNeedsOutcome: boolean;
  onDraftChange: (value: string) => void;
  onAdjust: (factor: number) => void;
  onAllocateAllRemaining: () => void;
  onAddOutcome: (text: string) => void;
  onDeleteOutcome: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const QUICK_ADJUSTMENTS = [
  { label: "+5%", factor: 1.05 },
  { label: "+10%", factor: 1.1 },
  { label: "+20%", factor: 1.2 },
  { label: "−5%", factor: 0.95 },
  { label: "−10%", factor: 0.9 },
  { label: "−20%", factor: 0.8 },
];

/** Modal for editing one department's allocation and its outcomes. */
export default function EditDeptModal({
  editing,
  draft,
  editingPrior,
  editingPct,
  remainingForEditing,
  outcomes,
  editingNeedsOutcome,
  onDraftChange,
  onAdjust,
  onAllocateAllRemaining,
  onAddOutcome,
  onDeleteOutcome,
  onSave,
  onClose,
}: EditDeptModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit ${editing.name}`}
      onClick={onClose}
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
          {editing.category} · last year {dollars.format(editingPrior)}
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
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onClose();
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
          {QUICK_ADJUSTMENTS.map(({ label, factor }) => (
            <button
              key={label}
              type="button"
              onClick={() => onAdjust(factor)}
              style={adjustButtonStyle}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onAllocateAllRemaining}
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
          outcomes={outcomes}
          onAdd={onAddOutcome}
          onDelete={onDeleteOutcome}
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
            onClick={onClose}
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
            onClick={onSave}
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
  );
}
