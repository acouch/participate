"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { budgetHref, type BudgetSummary } from "@/src/lib/account-budgets";

/** A budget row plus the owner's email, which only admins get to see. */
export interface AdminBudgetSummary extends BudgetSummary {
  ownerEmail: string | null;
}

interface AdminBudgetsProps {
  budgets: AdminBudgetSummary[];
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

const cellStyle: React.CSSProperties = {
  padding: "0.6rem 0.5rem",
  borderBottom: "1px solid #eee",
  fontSize: "0.875rem",
  verticalAlign: "top",
};

/** Every budget in the system, with admin edit and delete. */
export default function AdminBudgets({
  budgets,
  onRename,
  onDelete,
}: AdminBudgetsProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return budgets;
    return budgets.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.ownerEmail ?? "").toLowerCase().includes(q),
    );
  }, [budgets, query]);

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

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter by id, name or owner email"
        aria-label="Filter budgets"
        style={{
          width: "100%",
          marginBottom: "1rem",
          padding: "0.55rem 0.7rem",
          fontSize: "0.9rem",
          border: "1px solid #d4d4d4",
          borderRadius: "0.5rem",
          fontFamily: "inherit",
        }}
      />

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

      {visible.length === 0 ? (
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          No budgets match that filter.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {[
                  "Budget",
                  "Owner",
                  "Status",
                  "Changed",
                  "Updated",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      ...cellStyle,
                      textAlign: "left",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: "#666",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((budget) => {
                const busy = busyId === budget.id;
                return (
                  <tr key={budget.id}>
                    <td style={cellStyle}>
                      {editingId === budget.id ? (
                        <div style={{ display: "flex", gap: "0.4rem" }}>
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
                              padding: "0.3rem 0.45rem",
                              fontSize: "0.85rem",
                              border: "1px solid #d4d4d4",
                              borderRadius: "0.35rem",
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
                        </div>
                      ) : (
                        <>
                          <Link
                            href={budgetHref(budget)}
                            style={{ fontWeight: 600, color: "#1a3cb9" }}
                          >
                            {budget.name}
                          </Link>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#888",
                              fontFamily: "monospace",
                            }}
                          >
                            {budget.id}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ ...cellStyle, color: "#555" }}>
                      {budget.ownerEmail ?? (
                        <span style={{ color: "#999", fontStyle: "italic" }}>
                          anonymous
                        </span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "999px",
                          background: budget.submitted ? "#eaf3ea" : "#eef2fb",
                          color: budget.submitted ? "#1c5c2e" : "#1a3cb9",
                        }}
                      >
                        {budget.submitted ? "Submitted" : "Draft"}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, color: "#666" }}>
                      {budget.changeCount > 0 ? (
                        <>
                          {budget.changeCount}{" "}
                          <span style={{ color: "#999" }}>
                            dept{budget.changeCount === 1 ? "" : "s"}
                          </span>
                        </>
                      ) : (
                        <span style={{ color: "#999" }}>&mdash;</span>
                      )}
                    </td>
                    <td style={{ ...cellStyle, color: "#666" }}>
                      {dateFmt.format(new Date(budget.updatedAt))}
                    </td>
                    <td style={cellStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.7rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <Link href={budgetHref(budget)} style={actionStyle}>
                          {budget.submitted ? "View" : "Edit"}
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(budget.id);
                            setDraftName(budget.name);
                            setConfirmingId(null);
                            setError(null);
                          }}
                          style={actionStyle}
                        >
                          Rename
                        </button>
                        {confirmingId === budget.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => confirmDelete(budget.id)}
                              disabled={busy}
                              style={{ ...actionStyle, color: "#8c1c1c" }}
                            >
                              {busy ? "Deleting…" : "Confirm delete"}
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
