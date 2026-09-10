import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Captures what the Resend SDK was asked to send. */
const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

/**
 * FROM and the cached client are module-level, so each test imports a fresh
 * copy after setting env vars.
 */
async function load() {
  vi.resetModules();
  return import("./email");
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "sent" }, error: null });
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendPasswordResetEmail without an API key", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  it("logs the link instead of sending in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { sendPasswordResetEmail } = await load();

    await sendPasswordResetEmail({
      to: "mayor@example.com",
      url: "http://localhost:3000/reset?token=abc",
    });

    // Local dev has no mailer, so the flow stays testable via the console.
    expect(send).not.toHaveBeenCalled();
    const logged = log.mock.calls[0]?.join(" ") ?? "";
    expect(logged).toContain("mayor@example.com");
    expect(logged).toContain("http://localhost:3000/reset?token=abc");
  });

  it("throws in production rather than silently dropping the email", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { sendPasswordResetEmail } = await load();

    // A missing key in production must surface loudly — a swallowed reset
    // email looks to the user like the account is broken.
    await expect(
      sendPasswordResetEmail({ to: "a@b.com", url: "https://x/reset" }),
    ).rejects.toThrow("RESEND_API_KEY is not set");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("sendPasswordResetEmail with an API key", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    vi.stubEnv("NODE_ENV", "production");
  });

  it("sends to the recipient with the reset link in both bodies", async () => {
    const { sendPasswordResetEmail } = await load();
    await sendPasswordResetEmail({
      to: "mayor@example.com",
      url: "https://philly.example/reset?token=xyz",
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toBe("mayor@example.com");
    expect(payload.subject).toBe("Reset your password");
    // Plain-text alternative matters: some clients never render the HTML.
    expect(payload.html).toContain("https://philly.example/reset?token=xyz");
    expect(payload.text).toContain("https://philly.example/reset?token=xyz");
  });

  it("falls back to the resend.dev sender until a domain is verified", async () => {
    delete process.env.EMAIL_FROM;
    const { sendPasswordResetEmail } = await load();
    await sendPasswordResetEmail({ to: "a@b.com", url: "https://x/reset" });

    expect(send.mock.calls[0][0].from).toContain("onboarding@resend.dev");
  });

  it("uses EMAIL_FROM once one is configured", async () => {
    process.env.EMAIL_FROM = "Philly Budget <noreply@philly.example>";
    const { sendPasswordResetEmail } = await load();
    await sendPasswordResetEmail({ to: "a@b.com", url: "https://x/reset" });

    expect(send.mock.calls[0][0].from).toBe(
      "Philly Budget <noreply@philly.example>",
    );
  });

  it("throws when Resend reports a failure", async () => {
    // The SDK returns errors rather than throwing, so an unchecked call would
    // report success on a bounced send.
    send.mockResolvedValue({
      data: null,
      error: { message: "domain not verified" },
    });
    const { sendPasswordResetEmail } = await load();

    await expect(
      sendPasswordResetEmail({ to: "a@b.com", url: "https://x/reset" }),
    ).rejects.toThrow("domain not verified");
  });
});

describe("admin notifications", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ADMIN_EMAILS = "admin@example.com, second@example.com";
    vi.stubEnv("NODE_ENV", "production");
    process.env.BETTER_AUTH_URL = "https://budget.example";
  });

  it("emails every configured admin on the first meaningful edit", async () => {
    const { notifyBudgetStarted } = await load();
    await notifyBudgetStarted({ budgetId: "abc12", changeCount: 2 });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.to).toEqual(["admin@example.com", "second@example.com"]);
    expect(payload.subject).toContain("abc12");
    expect(payload.html).toContain("https://budget.example/budget/abc12/edit");
    expect(payload.html).toContain("2 departments changed");
  });

  it("includes the name, tagline and change count on submission", async () => {
    const { notifyBudgetSubmitted } = await load();
    await notifyBudgetSubmitted({
      budgetId: "abc12",
      name: "Mayor Ada",
      tagline: "Safer streets",
      changeCount: 3,
    });

    const payload = send.mock.calls[0][0];
    expect(payload.subject).toContain("Mayor Ada");
    expect(payload.html).toContain("Safer streets");
    expect(payload.html).toContain("3 departments changed");
    expect(payload.html).toContain("https://budget.example/budget/abc12");
  });

  it("singularizes a single changed department", async () => {
    const { notifyBudgetSubmitted } = await load();
    await notifyBudgetSubmitted({ budgetId: "abc12", changeCount: 1 });
    expect(send.mock.calls[0][0].html).toContain("1 department changed");
  });

  it("falls back to a placeholder when the budget has no name", async () => {
    const { notifyBudgetSubmitted } = await load();
    await notifyBudgetSubmitted({ budgetId: "abc12", changeCount: 0 });
    expect(send.mock.calls[0][0].subject).toContain("Untitled budget");
  });

  it("sends nothing when no admins are configured", async () => {
    // Without this guard Resend would be called with an empty recipient list.
    process.env.ADMIN_EMAILS = "";
    const { notifyBudgetStarted } = await load();
    await notifyBudgetStarted({ budgetId: "abc12", changeCount: 1 });
    expect(send).not.toHaveBeenCalled();
  });

  it("never throws when sending fails", async () => {
    // A notification failure must not break budget creation or submission.
    send.mockRejectedValue(new Error("resend is down"));
    const { notifyBudgetStarted } = await load();
    await expect(
      notifyBudgetStarted({ budgetId: "abc12", changeCount: 1 }),
    ).resolves.toBeUndefined();
  });

  it("never throws when Resend reports an error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "bad domain" } });
    const { notifyBudgetSubmitted } = await load();
    await expect(
      notifyBudgetSubmitted({ budgetId: "abc12", changeCount: 0 }),
    ).resolves.toBeUndefined();
  });

  it("logs instead of sending when no API key is set", async () => {
    delete process.env.RESEND_API_KEY;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { notifyBudgetStarted } = await load();
    await notifyBudgetStarted({ budgetId: "abc12", changeCount: 1 });
    expect(send).not.toHaveBeenCalled();
    expect(log.mock.calls[0]?.join(" ")).toContain("admin@example.com");
  });
});

describe("escapeHtml", () => {
  it("neutralizes tags and quotes", async () => {
    const { escapeHtml } = await load();
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands first so entities are not double-broken", async () => {
    const { escapeHtml } = await load();
    expect(escapeHtml("Tom & Jerry <b>")).toBe("Tom &amp; Jerry &lt;b&gt;");
  });

  it("leaves ordinary text alone", async () => {
    const { escapeHtml } = await load();
    expect(escapeHtml("More money for libraries, please!")).toBe(
      "More money for libraries, please!",
    );
  });
});

describe("notifyFeedbackPosted", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.ADMIN_EMAILS = "admin@example.com";
    vi.stubEnv("NODE_ENV", "production");
  });

  it("emails admins with the message, name and page", async () => {
    const { notifyFeedbackPosted } = await load();
    await notifyFeedbackPosted({
      name: "Ada",
      email: "ada@example.com",
      message: "The treemap is hard to read on mobile.",
      path: "/budget/abc12/edit",
    });

    const payload = send.mock.calls[0][0];
    expect(payload.to).toEqual(["admin@example.com"]);
    expect(payload.subject).toContain("Ada");
    expect(payload.html).toContain("The treemap is hard to read on mobile.");
    expect(payload.html).toContain("/budget/abc12/edit");
    expect(payload.html).toContain("mailto:");
  });

  it("escapes HTML in the message so feedback cannot inject markup", async () => {
    // Feedback is anonymous free text; unescaped it would render as markup
    // in the admin's mail client.
    const { notifyFeedbackPosted } = await load();
    await notifyFeedbackPosted({
      message: '<img src=x onerror="alert(1)">',
      name: "<b>bold</b>",
    });

    const html = send.mock.calls[0][0].html;
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;img");
  });

  it("says so when no reply address was given", async () => {
    const { notifyFeedbackPosted } = await load();
    await notifyFeedbackPosted({ message: "Anonymous note" });
    const html = send.mock.calls[0][0].html;
    expect(html).toContain("no way to reply");
    expect(html).not.toContain("mailto:");
  });

  it("falls back to 'Someone' when no name is given", async () => {
    const { notifyFeedbackPosted } = await load();
    await notifyFeedbackPosted({ message: "hi" });
    expect(send.mock.calls[0][0].subject).toContain("Someone");
  });

  it("never throws when sending fails", async () => {
    // Feedback is already saved by this point; a mail failure must not turn
    // a successful submission into an error for the visitor.
    send.mockRejectedValue(new Error("resend down"));
    const { notifyFeedbackPosted } = await load();
    await expect(
      notifyFeedbackPosted({ message: "hi" }),
    ).resolves.toBeUndefined();
  });

  it("sends nothing when no admins are configured", async () => {
    process.env.ADMIN_EMAILS = "";
    const { notifyFeedbackPosted } = await load();
    await notifyFeedbackPosted({ message: "hi" });
    expect(send).not.toHaveBeenCalled();
  });
});
