/** Shared inline styles for the auth forms, matching the app's form styling. */

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.7rem",
  fontSize: "0.9rem",
  border: "1px solid #d4d4d4",
  borderRadius: "0.5rem",
  fontFamily: "inherit",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: "0.8rem",
  margin: "0.85rem 0 0.35rem",
};

export const buttonStyle = (enabled: boolean): React.CSSProperties => ({
  width: "100%",
  marginTop: "1.25rem",
  padding: "0.6rem 1.25rem",
  fontSize: "1rem",
  fontWeight: 600,
  border: "none",
  borderRadius: "0.5rem",
  background: "var(--color-blue-800)",
  color: "#fff",
  cursor: enabled ? "pointer" : "not-allowed",
  // The dimming is what makes the disabled state readable — without it the
  // button looks clickable while the form is still incomplete.
  opacity: enabled ? 1 : 0.5,
});

export const errorStyle: React.CSSProperties = {
  marginTop: "0.85rem",
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
  borderRadius: "0.5rem",
  background: "#fdeaea",
  color: "#8c1c1c",
};

export const noticeStyle: React.CSSProperties = {
  marginTop: "0.85rem",
  padding: "0.55rem 0.7rem",
  fontSize: "0.85rem",
  borderRadius: "0.5rem",
  background: "#eaf3ea",
  color: "#1c5c2e",
};

export const cardStyle: React.CSSProperties = {
  maxWidth: "24rem",
  margin: "3rem auto",
  padding: "0 1rem",
};
