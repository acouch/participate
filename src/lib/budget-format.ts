import type React from "react";

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

export const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const signedPct = (pct: number) =>
  `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

export const pctTextColor = (pct: number | null) =>
  pct == null ? "#666" : pct > 0 ? "#16a34a" : pct < 0 ? "#dc2626" : "#666";

export const adjustButtonStyle: React.CSSProperties = {
  padding: "0.4rem 0.5rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  border: "1px solid #d4d4d4",
  borderRadius: "0.375rem",
  background: "#f9f9f9",
  color: "#333",
  cursor: "pointer",
};

export const categoryChipStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.3rem 0.6rem",
  fontSize: "0.75rem",
  fontWeight: 600,
  borderRadius: "999px",
  border: `1px solid ${active ? "#2563eb" : "#d4d4d4"}`,
  background: active ? "#eff6ff" : "#fff",
  color: active ? "#2563eb" : "#444",
  cursor: "pointer",
});
