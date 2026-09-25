"use client";

import { useState } from "react";

const field = "h-10 w-full rounded-lg border border-rule bg-card px-3 text-sm outline-none focus:border-ink-3 focus:shadow-[0_0_0_3px_hsl(var(--rule-2))]";

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
    website: "", // honeypot, hidden from people
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send message");
      }
      setStatus("success");
      setFormData({ name: "", email: "", message: "", website: "" });
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-[10px] border border-rule bg-card p-5" role="status">
        <p className="font-serif text-xl">Thank you. Your message is on its way.</p>
        <button type="button" className="mt-3 text-[13px] text-ink-2 underline underline-offset-4" onClick={() => setStatus("idle")}>Send another</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[12.5px] text-ink-2">Name
          <input className={field} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required maxLength={100} autoComplete="name" />
        </label>
        <label className="grid gap-1 text-[12.5px] text-ink-2">Email
          <input className={field} type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required maxLength={200} autoComplete="email" />
        </label>
      </div>
      <label className="grid gap-1 text-[12.5px] text-ink-2">Message
        <textarea className={`${field} h-28 resize-none py-2`} value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} required maxLength={5000} />
      </label>
      {status === "error" && <p className="text-[13px] text-brand" role="alert">{errorMessage}</p>}
      <div>
        <button type="submit" disabled={status === "loading"} className="inline-flex h-9 items-center rounded-lg border border-ink bg-ink px-4 text-sm font-medium text-surface hover:opacity-90 disabled:opacity-60">
          {status === "loading" ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
