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
