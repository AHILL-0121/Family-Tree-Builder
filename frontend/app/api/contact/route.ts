import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { contactSchema, createRateLimiter, renderContactEmail } from "@/lib/contact";

const limiter = createRateLimiter(5, 10 * 60 * 1000); // 5 messages per IP per 10 minutes

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || request.ip || "unknown";
}

export async function POST(request: NextRequest) {
  const rate = limiter(clientIp(request));
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many messages. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    // A filled honeypot means a bot: pretend success so it learns nothing.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) {
      if (process.env.NODE_ENV !== "production") console.info("Contact mail not sent: the hidden honeypot field was filled");
      return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
    }
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const to = process.env.CONTACT_TO;
  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("Contact form is not configured: set SMTP_USER, SMTP_PASS and CONTACT_TO");
    return NextResponse.json({ error: "Contact form is not configured" }, { status: 503 });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const { name, email } = parsed.data;
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      replyTo: email,
      subject: `Family Tree Builder: message from ${name.replace(/[\r\n]+/g, " ")}`,
      html: renderContactEmail(parsed.data),
      text: `${name} <${email}>\n\n${parsed.data.message}`,
    });
    // "250 ... OK" means Gmail accepted it; if it doesn't arrive, look in the recipient's Spam
    if (process.env.NODE_ENV !== "production") console.info(`Contact mail to ${to}: ${info.response}`);
    return NextResponse.json({ message: "Email sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
