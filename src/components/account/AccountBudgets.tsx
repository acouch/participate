"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { budgetHref, type BudgetSummary } from "@/src/lib/account-budgets";

interface AccountBudgetsProps {
  budgets: BudgetSummary[];
  onRename: (
    budgetId: string,
    name: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (budgetId: string) => Promise<{ ok: boolean; error?: string }>;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const cardStyle: React.CSSProperties = {
  padding: "1rem 1.1rem",
  border: "1px solid #e2e2e2",
  borderRadius: "0.6rem",
  background: "#fff",
};

const actionStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#1a3cb9",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
};

/** The signed-in user's budgets, with rename and delete. */
export default function AccountBudgets({
  budgets,
  onRename,
  onDelete,
}: AccountBudgetsProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startRename(budget: BudgetSummary) {
    setEditingId(budget.id);
    setDraftName(budget.name);
    setConfirmingId(null);
    setError(null);
  }

  async function saveRename(budgetId: string) {
    if (busyId) return;
    setBusyId(budgetId);
    setError(null);
    const result = await onRename(budgetId, draftName);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not rename that budget.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function confirmDelete(budgetId: string) {
    if (busyId) return;
    setBusyId(budgetId);
    setError(null);
    const result = await onDelete(budgetId);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not delete that budget.");
      return;
    }
    setConfirmingId(null);
    router.refresh();
  }

  if (budgets.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: "center", padding: "2rem 1rem" }}>
        <p style={{ marginBottom: "1rem" }}>
          You haven&rsquo;t made a budget yet.
        </p>
        <Link
          href="/start"
          style={{
            display: "inline-block",
            padding: "0.6rem 1.25rem",
            fontSize: "1rem",
            fontWeight: 600,
            borderRadius: "0.5rem",
            background: "#1a3cb9",
            color: "#fff",
          }}
        >
          Make your first budget
        </Link>
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "0.85rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700 }}>
          Your budgets ({budgets.length})
        </h2>
        <Link href="/start" style={{ ...actionStyle, cursor: "pointer" }}>
          + New budget
        </Link>
      </div>

      {error && (
        <p
          style={{
            marginBottom: "0.85rem",
            padding: "0.55rem 0.7rem",
            fontSize: "0.85rem",
            borderRadius: "0.5rem",
            background: "#fdeaea",
            color: "#8c1c1c",
          }}
        >
          {error}
        </p>
      )}

      <ul style={{ display: "grid", gap: "0.75rem", listStyle: "none" }}>
        {budgets.map((budget) => {
          const busy = busyId === budget.id;
          return (
            <li key={budget.id} style={cardStyle}>
              {editingId === budget.id ? (
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    aria-label="Budget name"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(budget.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: "0.45rem 0.6rem",
                      fontSize: "0.95rem",
                      border: "1px solid #d4d4d4",
                      borderRadius: "0.4rem",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => saveRename(budget.id)}
                    disabled={busy}
                    style={actionStyle}
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    style={{ ...actionStyle, color: "#666" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "0.6rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      href={budgetHref(budget)}
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        color: "#1a3cb9",
                      }}
                    >
                      {budget.name}
                    </Link>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "0.15rem 0.45rem",
                        borderRadius: "999px",
                        background: budget.submitted ? "#eaf3ea" : "#eef2fb",
                        color: budget.submitted ? "#1c5c2e" : "#1a3cb9",
                      }}
                    >
                      {budget.submitted ? "Submitted" : "Draft"}
                    </span>
                  </div>

                  {budget.tagline && (
                    <p
                      style={{
                        margin: "0.3rem 0 0",
                        fontSize: "0.9rem",
                        color: "#555",
                        fontStyle: "italic",
                      }}
                    >
                      {budget.tagline}
                    </p>
                  )}

                  <p
                    style={{
                      margin: "0.45rem 0 0",
                      fontSize: "0.8rem",
                      color: "#666",
                    }}
                  >
                    {budget.changeCount > 0
                      ? `${budget.changeCount} department${budget.changeCount === 1 ? "" : "s"} changed`
                      : "No changes yet"}
                    {" · "}
                    {budget.submitted && budget.submittedAt
                      ? `Submitted ${dateFmt.format(new Date(budget.submittedAt))}`
                      : `Updated ${dateFmt.format(new Date(budget.updatedAt))}`}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      marginTop: "0.7rem",
                      alignItems: "center",
                    }}
                  >
                    <Link href={budgetHref(budget)} style={actionStyle}>
                      {budget.submitted ? "View" : "Edit"}
                    </Link>
                    <button
                      type="button"
                      onClick={() => startRename(budget)}
                      style={actionStyle}
                    >
                      Rename
                    </button>
                    {confirmingId === budget.id ? (
                      <>
                        <span style={{ fontSize: "0.85rem", color: "#8c1c1c" }}>
                          Delete permanently?
                        </span>
                        <button
                          type="button"
                          onClick={() => confirmDelete(budget.id)}
                          disabled={busy}
                          style={{ ...actionStyle, color: "#8c1c1c" }}
                        >
                          {busy ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          style={{ ...actionStyle, color: "#666" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingId(budget.id);
                          setError(null);
                        }}
                        style={{ ...actionStyle, color: "#8c1c1c" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
