import { describe, expect, it } from "vitest";
import { contactSchema, createRateLimiter, escapeHtml, renderContactEmail } from "./contact";

describe("escapeHtml", () => {
  it("neutralises markup", () => {
    expect(escapeHtml(`<a href="x">'hi' & bye</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;hi&#39; &amp; bye&lt;/a&gt;");
  });
});

describe("renderContactEmail", () => {
  it("never passes user HTML through", () => {
    const html = renderContactEmail({
      name: `<img src=x onerror=alert(1)>`,
      email: "a@b.co",
      message: `<script>steal()</script><a href="https://evil">Click</a>`,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('<a href="https://evil">');
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("contactSchema", () => {
  const ok = { name: "Kamala", email: "kamala@example.com", message: "Hello" };
  it("accepts a normal message", () => {
    expect(contactSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects bad emails, empty and oversized fields, and non-strings", () => {
    expect(contactSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: "x".repeat(5001) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, name: 42 }).success).toBe(false);
  });
  it("flags a filled honeypot", () => {
    const r = contactSchema.safeParse({ ...ok, website: "http://spam" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe("website");
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks until the window resets", () => {
    const check = createRateLimiter(2, 1000);
    expect(check("ip", 0).ok).toBe(true);
    expect(check("ip", 10).ok).toBe(true);
    const blocked = check("ip", 20);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(check("other", 20).ok).toBe(true);
    expect(check("ip", 1000).ok).toBe(true);
  });
});
