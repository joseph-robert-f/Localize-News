"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

type FormState = "idle" | "submitting" | "success" | "error";

export default function RequestPage() {
  const [form, setForm] = useState({
    township_name: "",
    website_url: "",
    contact_email: "",
    notes: "",
  });
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-zinc-950">
        <div className="w-full max-w-md text-center">
          <div className="mb-4 text-4xl">✓</div>
          <h1 className="mb-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Request received
          </h1>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            We&apos;ll review your submission and add{" "}
            <strong>{form.township_name}</strong> to the queue.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-4">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Request a township
        </h1>
        <p className="mb-8 text-zinc-600 dark:text-zinc-400">
          Know a township we haven&apos;t indexed yet? Submit a request and we&apos;ll
          review it before adding it to the platform.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Township name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="township_name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Township name <span className="text-red-500">*</span>
            </label>
            <input
              id="township_name"
              name="township_name"
              type="text"
              required
              value={form.township_name}
              onChange={handleChange}
              placeholder="e.g. Springfield Township"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Website URL */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="website_url" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Township website <span className="text-red-500">*</span>
            </label>
            <input
              id="website_url"
              name="website_url"
              type="url"
              required
              value={form.website_url}
              onChange={handleChange}
              placeholder="https://www.yourtown.gov"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Contact email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact_email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Your email <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              id="contact_email"
              name="contact_email"
              type="email"
              value={form.contact_email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Notes <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              placeholder="Anything that might help us find the right documents…"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {state === "error" && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {errorMsg}
            </p>
          )}

          <Button type="submit" loading={state === "submitting"}>
            Submit request
          </Button>
        </form>
      </main>
    </div>
  );
}
