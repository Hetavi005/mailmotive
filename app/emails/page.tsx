"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type EmailMessage = {
  id: string;
  user_id: string;
  professor_id: string;
  subject: string;
  email_body: string;
  send_datetime: string;
  status: string;
  sent_time: string | null;
  error: string | null;
  blocked_reason: string | null;
  trigger_created_at: string | null;
  trigger_note: string | null;
  followup_required: boolean;
  followup_after_days: number;
  created_at: string;
  professors: {
    professor_name: string;
    email: string;
    university: string | null;
    category: string | null;
    research_area: string | null;
  } | null;
};

const STATUS_OPTIONS = [
  "All",
  "Draft",
  "Scheduled",
  "Trigger Created",
  "Sending",
  "Sent",
  "Failed",
  "Auth Required",
  "Quota Blocked",
  "Paused",
  "Manual Review",
  "Cancelled",
  "Replied",
  "Followup Needed",
  "Closed",
];

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getTriggerDisplay(email: EmailMessage) {
  if (email.trigger_created_at) {
    return formatDateTime(email.trigger_created_at);
  }

  if (email.status === "Scheduled") {
    return "Waiting for 30-min registration trigger";
  }

  if (email.status === "Cancelled") {
    return "Cancelled before trigger";
  }

  return "—";
}

function getSentDisplay(email: EmailMessage) {
  if (email.sent_time) {
    return formatDateTime(email.sent_time);
  }

  if (email.status === "Scheduled") {
    return "Not sent yet";
  }

  if (email.status === "Trigger Created") {
    return "Waiting for scheduled send time";
  }

  if (email.status === "Sending") {
    return "Sending now";
  }

  if (email.status === "Failed") {
    return "Failed before sending";
  }

  if (email.status === "Quota Blocked") {
    return "Blocked by quota";
  }

  return "—";
}

function getStatusClass(status: string) {
  if (status === "Sent") {
    return "bg-emerald-400/10 text-emerald-300 border-emerald-500/30";
  }

  if (status === "Failed") {
    return "bg-red-400/10 text-red-300 border-red-500/30";
  }

  if (status === "Scheduled") {
    return "bg-blue-400/10 text-blue-300 border-blue-500/30";
  }

  if (status === "Trigger Created") {
    return "bg-purple-400/10 text-purple-300 border-purple-500/30";
  }

  if (status === "Sending") {
    return "bg-yellow-400/10 text-yellow-300 border-yellow-500/30";
  }

  if (status === "Quota Blocked" || status === "Manual Review") {
    return "bg-orange-400/10 text-orange-300 border-orange-500/30";
  }

  return "bg-slate-800 text-slate-300 border-slate-700";
}

export default function EmailsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchText, setSearchText] = useState("");

  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      const matchesStatus =
        statusFilter === "All" || email.status === statusFilter;

      const text = searchText.toLowerCase().trim();

      const matchesSearch =
        !text ||
        email.subject.toLowerCase().includes(text) ||
        email.professors?.professor_name?.toLowerCase().includes(text) ||
        email.professors?.email?.toLowerCase().includes(text) ||
        email.professors?.university?.toLowerCase().includes(text) ||
        email.professors?.category?.toLowerCase().includes(text);

      return matchesStatus && matchesSearch;
    });
  }, [emails, statusFilter, searchText]);

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;
      setUserId(currentUserId);

      await loadEmails(currentUserId);
      setLoading(false);
    }

    initialize();
  }, [router]);

  async function loadEmails(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    const { data, error } = await supabase
      .from("email_messages")
      .select(
        `
        id,
        user_id,
        professor_id,
        subject,
        email_body,
        send_datetime,
        status,
        sent_time,
        error,
        blocked_reason,
        trigger_created_at,
        trigger_note,
        followup_required,
        followup_after_days,
        created_at,
        professors (
          professor_name,
          email,
          university,
          category,
          research_area
        )
      `
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading emails: " + error.message);
      return;
    }

    setEmails((data ?? []) as unknown as EmailMessage[]);
  }

  async function handleCancelEmail(email: EmailMessage) {
    const confirmed = window.confirm(
      "Cancel this scheduled email? This only updates MailMotive status. If a Google trigger was already created, it may still run, but sendDueEmails will skip it because status will no longer be Trigger Created."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("email_messages")
      .update({
        status: "Cancelled",
        updated_at: new Date().toISOString(),
        blocked_reason: "Cancelled manually from MailMotive emails page.",
      })
      .eq("id", email.id);

    if (error) {
      setMessage("Error cancelling email: " + error.message);
      return;
    }

    await supabase.from("email_events").insert({
      user_id: email.user_id,
      email_message_id: email.id,
      event_type: "Cancelled",
      event_note: "Email cancelled manually from MailMotive emails page.",
    });

    setMessage("Email cancelled.");
    await loadEmails();
  }

  async function handleMarkManualReview(email: EmailMessage) {
    const { error } = await supabase
      .from("email_messages")
      .update({
        status: "Manual Review",
        updated_at: new Date().toISOString(),
        blocked_reason: "Marked for manual review from MailMotive emails page.",
      })
      .eq("id", email.id);

    if (error) {
      setMessage("Error updating email: " + error.message);
      return;
    }

    await supabase.from("email_events").insert({
      user_id: email.user_id,
      email_message_id: email.id,
      event_type: "Manual Review",
      event_note: "Email marked for manual review.",
    });

    setMessage("Email marked for manual review.");
    await loadEmails();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading emails...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Emails</h1>
            <p className="mt-2 text-slate-400">
              Track scheduled, trigger-created, sent, failed, and blocked
              outreach emails.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
            </Link>

            <Link
              href="/outreach/new"
              className="rounded-xl bg-blue-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-300"
            >
              New Outreach
            </Link>

            <Link
              href="/professors"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Professors
            </Link>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Logout
            </button>
          </div>
        </header>

        {message && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-[1fr_240px_160px]">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400"
            placeholder="Search by professor, email, university, category, subject..."
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadEmails()}
            className="rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300"
          >
            Refresh
          </button>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Email List</h2>
              <p className="mt-1 text-sm text-slate-400">
                Showing {filteredEmails.length} of {emails.length} emails.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredEmails.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-400">
                No emails found.
              </div>
            ) : (
              filteredEmails.map((email) => (
                <article
                  key={email.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            email.status
                          )}`}
                        >
                          {email.status}
                        </span>

                        {email.followup_required && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                            Follow-up after {email.followup_after_days} days
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-lg font-semibold">
                        {email.subject}
                      </h3>

                      <p className="mt-1 text-sm text-slate-400">
                        {email.professors?.professor_name || "Unknown professor"}{" "}
                        — {email.professors?.email || "No email"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {email.professors?.university && (
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            {email.professors.university}
                          </span>
                        )}

                        {email.professors?.category && (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
                            {email.professors.category}
                          </span>
                        )}

                        {email.professors?.research_area && (
                          <span className="rounded-full bg-blue-400/10 px-3 py-1 text-blue-300">
                            {email.professors.research_area}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {["Scheduled", "Trigger Created", "Quota Blocked"].includes(
                        email.status
                      ) && (
                        <button
                          onClick={() => handleCancelEmail(email)}
                          className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950"
                        >
                          Cancel
                        </button>
                      )}

                      {["Failed", "Quota Blocked"].includes(email.status) && (
                        <button
                          onClick={() => handleMarkManualReview(email)}
                          className="rounded-lg border border-orange-700 px-3 py-2 text-xs text-orange-300 hover:bg-orange-950"
                        >
                          Manual Review
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs text-slate-500">Scheduled</p>
                      <p className="mt-1 text-slate-300">
                        {formatDateTime(email.send_datetime)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs text-slate-500">Trigger created</p>
                      <p className="mt-1 text-slate-300">
                          {getTriggerDisplay(email)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs text-slate-500">Sent</p>
                      <p className="mt-1 text-slate-300">
                          {getSentDisplay(email)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                      <p className="text-xs text-slate-500">Created</p>
                      <p className="mt-1 text-slate-300">
                        {formatDateTime(email.created_at)}
                      </p>
                    </div>
                  </div>

                  {(email.trigger_note || email.blocked_reason || email.error) && (
                    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
                      {email.trigger_note && (
                        <p className="text-slate-400">
                          <span className="text-slate-500">Trigger note:</span>{" "}
                          {email.trigger_note}
                        </p>
                      )}

                      {email.blocked_reason && (
                        <p className="mt-2 text-orange-300">
                          <span className="text-slate-500">Blocked:</span>{" "}
                          {email.blocked_reason}
                        </p>
                      )}

                      {email.error && (
                        <p className="mt-2 text-red-300">
                          <span className="text-slate-500">Error:</span>{" "}
                          {email.error}
                        </p>
                      )}
                    </div>
                  )}

                  <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <summary className="cursor-pointer text-sm text-slate-300">
                      Preview email body
                    </summary>

                    <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-400">
                      {email.email_body}
                    </pre>
                  </details>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}