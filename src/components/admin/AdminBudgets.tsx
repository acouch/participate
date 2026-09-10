"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  budgetHref,
  DEFAULT_SORT_DIRECTION,
  matchesChanged,
  matchesOwner,
  matchesStatus,
  sortBudgetsBy,
  type BudgetSummary,
  type ChangedFilter,
  type SortDirection,
  type SortKey,
  type StatusFilter,
} from "@/src/lib/account-budgets";

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
  onDeleteMany: (
    budgetIds: string[],
  ) => Promise<{ ok: boolean; deleted: number; error?: string }>;
  onSetFeatured: (
    budgetId: string,
    featured: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
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

/** Table columns; a null key means the column is not sortable. */
const COLUMNS: { label: string; key: SortKey | null }[] = [
  { label: "Budget", key: "name" },
  { label: "Owner", key: null },
  { label: "Status", key: "status" },
  { label: "Changed", key: "changed" },
  { label: "Updated", key: "updated" },
  { label: "Actions", key: null },
];

const filterLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.2rem",
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "#666",
};

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  fontSize: "0.875rem",
  fontWeight: 400,
  textTransform: "none",
  letterSpacing: "normal",
  color: "#111",
  border: "1px solid #d4d4d4",
  borderRadius: "0.4rem",
  fontFamily: "inherit",
  background: "#fff",
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
  onDeleteMany,
  onSetFeatured,
}: AdminBudgetsProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [changed, setChanged] = useState<ChangedFilter>("all");
  const [owner, setOwner] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? budgets.filter(
          (b) =>
            b.id.toLowerCase().includes(q) ||
            b.name.toLowerCase().includes(q) ||
            (b.ownerEmail ?? "").toLowerCase().includes(q),
        )
      : budgets;
    const narrowed = filtered.filter(
      (b) =>
        matchesStatus(b, status) &&
        matchesChanged(b, changed) &&
        matchesOwner(b.ownerEmail, owner),
    );
    return sortBudgetsBy(narrowed, sortKey, sortDir);
  }, [budgets, query, sortKey, sortDir, status, changed, owner]);

  /** Distinct owner addresses, for the owner dropdown. */
  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const b of budgets) if (b.ownerEmail) set.add(b.ownerEmail);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [budgets]);

  // Only rows currently visible can be acted on, so a hidden row is never
  // deleted by a "select all" the admin cannot see.
  const visibleIds = visible.map((b) => b.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmingBulk(false);
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) for (const id of visibleIds) next.delete(id);
      else for (const id of visibleIds) next.add(id);
      return next;
    });
    setConfirmingBulk(false);
  }

  async function bulkDelete() {
    if (bulkBusy || selectedVisible.length === 0) return;
    setBulkBusy(true);
    setError(null);
    const result = await onDeleteMany(selectedVisible);
    setBulkBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Could not delete those budgets.");
      return;
    }
    setSelected(new Set());
    setConfirmingBulk(false);
    router.refresh();
  }

  /** Clicking a column sorts by it; clicking the active column flips it. */
  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_SORT_DIRECTION[key]);
    }
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

  async function toggleFeatured(budgetId: string, featured: boolean) {
    if (busyId) return;
    setBusyId(budgetId);
    setError(null);
    const result = await onSetFeatured(budgetId, featured);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not update that budget.");
      return;
    }
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

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
        }}
      >
        <label style={filterLabelStyle}>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={selectStyle}
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
          </select>
        </label>

        <label style={filterLabelStyle}>
          Changed
          <select
            value={changed}
            onChange={(e) => setChanged(e.target.value as ChangedFilter)}
            style={selectStyle}
          >
            <option value="all">Any</option>
            <option value="some">Edited</option>
            <option value="none">Untouched</option>
          </select>
        </label>

        <label style={filterLabelStyle}>
          Owner
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All</option>
            <option value="anonymous">Anonymous</option>
            {owners.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </label>

        <span
          style={{
            alignSelf: "flex-end",
            fontSize: "0.8rem",
            color: "#666",
            paddingBottom: "0.35rem",
          }}
        >
          {visible.length} of {budgets.length}
        </span>
      </div>

      {selectedVisible.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
            padding: "0.6rem 0.8rem",
            borderRadius: "0.5rem",
            background: "#eef2fb",
            border: "1px solid #c7d2f0",
          }}
        >
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            {selectedVisible.length} selected
          </span>
          {confirmingBulk ? (
            <>
              <span style={{ fontSize: "0.85rem", color: "#8c1c1c" }}>
                Permanently delete {selectedVisible.length} budget
                {selectedVisible.length === 1 ? "" : "s"}?
              </span>
              <button
                type="button"
                onClick={bulkDelete}
                disabled={bulkBusy}
                style={{ ...actionStyle, color: "#8c1c1c" }}
              >
                {bulkBusy ? "Deleting…" : "Yes, delete them"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingBulk(false)}
                style={{ ...actionStyle, color: "#666" }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmingBulk(true)}
                style={{ ...actionStyle, color: "#8c1c1c" }}
              >
                Delete selected
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                style={{ ...actionStyle, color: "#666" }}
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

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
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "56rem",
            }}
          >
            <thead>
              <tr>
                <th style={{ ...cellStyle, width: "1.5rem" }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                    aria-label="Select all shown budgets"
                  />
                </th>
                {COLUMNS.map(({ label, key }) => {
                  const active = key !== null && key === sortKey;
                  return (
                    <th
                      key={label}
                      aria-sort={
                        active
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      style={{
                        ...cellStyle,
                        textAlign: "left",
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: active ? "#1a3cb9" : "#666",
                      }}
                    >
                      {key === null ? (
                        label
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          style={{
                            font: "inherit",
                            letterSpacing: "inherit",
                            textTransform: "inherit",
                            color: "inherit",
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          {label}
                          <span
                            aria-hidden
                            style={{ opacity: active ? 1 : 0.3 }}
                          >
                            {active
                              ? sortDir === "asc"
                                ? "\u2191"
                                : "\u2193"
                              : "\u2195"}
                          </span>
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((budget) => {
                const busy = busyId === budget.id;
                return (
                  <tr key={budget.id}>
                    <td style={cellStyle}>
                      <input
                        type="checkbox"
                        checked={selected.has(budget.id)}
                        onChange={() => toggleRow(budget.id)}
                        aria-label={`Select ${budget.name}`}
                      />
                    </td>
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
                    <td
                      style={{
                        ...cellStyle,
                        color: "#666",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {dateFmt.format(new Date(budget.updatedAt))}
                    </td>
                    <td style={cellStyle}>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.7rem",
                          alignItems: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <Link href={budgetHref(budget)} style={actionStyle}>
                          {budget.submitted ? "View" : "Edit"}
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            toggleFeatured(budget.id, !budget.featured)
                          }
                          disabled={busy}
                          title={
                            budget.featured
                              ? "Remove from /featured-budgets"
                              : "Show on /featured-budgets"
                          }
                          style={{
                            ...actionStyle,
                            color: budget.featured ? "#8a6d1f" : "#1a3cb9",
                          }}
                        >
                          {budget.featured ? "★ Featured" : "☆ Feature"}
                        </button>
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
