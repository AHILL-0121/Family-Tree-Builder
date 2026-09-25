import { z } from "zod";

// Everything user-supplied goes through here before it touches the email HTML.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000, "Message is too long"),
  // Honeypot: real people never see or fill this field.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type ContactInput = z.infer<typeof contactSchema>;

// Fixed-window limiter. In-memory state is per server instance, which is enough to stop a
// single client hammering one instance; a shared store (e.g. Upstash) is needed across instances.
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return function check(key: string, now = Date.now()): { ok: boolean; retryAfterSec: number } {
    const entry = hits.get(key);
    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    if (entry.count >= limit) {
      return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count += 1;
    return { ok: true, retryAfterSec: 0 };
  };
}

export function renderContactEmail({ name, email, message }: ContactInput, sentAt = new Date()): string {
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  const m = escapeHtml(message);
  const initial = escapeHtml(name.trim().charAt(0).toUpperCase() || "?");
  const mailto = `mailto:${encodeURIComponent(email)}`;
  const date = sentAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f6f3ec;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #ddd7ca;border-radius:12px;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #ddd7ca;">
          <p style="margin:0;color:#8a8579;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Family Tree Builder · contact form</p>
          <p style="margin:6px 0 0;color:#8a8579;font-size:12px;">${escapeHtml(date)}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td width="44" valign="middle"><div style="width:40px;height:40px;border-radius:50%;background:#ece6d9;text-align:center;line-height:40px;color:#57534a;font-size:18px;">${initial}</div></td>
            <td style="padding-left:12px;" valign="middle">
              <p style="margin:0;color:#1b1a17;font-size:16px;font-weight:600;">${n}</p>
              <p style="margin:2px 0 0;font-size:13px;"><a href="${mailto}" style="color:#b3432a;text-decoration:none;">${e}</a></p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;">
          <p style="margin:0;color:#1b1a17;font-size:15px;line-height:1.6;white-space:pre-wrap;">${m}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
