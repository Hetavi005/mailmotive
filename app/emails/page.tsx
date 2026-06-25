"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";

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

function getSchedulerDisplay(email: EmailMessage) {
  if (email.status === "Scheduled") {
    return "Waiting for recurring scheduler";
  }

  if (email.status === "Trigger Created") {
    return "Legacy trigger status";
  }

  if (email.status === "Sending") {
    return "Picked by scheduler";
  }

  if (email.status === "Cancelled") {
    return "Cancelled before sending";
  }

  if (email.trigger_created_at) {
    return "Legacy trigger: " + formatDateTime(email.trigger_created_at);
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
    return "Waiting for recurring scheduler";
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

function getStatusStyle(status: string) {
  if (status === "Sent") {
    return "bg-[#dcf5e7] text-[#171a21] border-black/8";
  }

  if (status === "Scheduled") {
    return "bg-[#dbe6ff] text-[#171a21] border-black/8";
  }

  if (status === "Trigger Created") {
    return "bg-[#f4dceb] text-[#171a21] border-black/8";
  }

  if (status === "Sending") {
    return "bg-[#eef3d9] text-[#171a21] border-black/8";
  }

  if (status === "Failed") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (status === "Quota Blocked" || status === "Manual Review") {
    return "bg-[#eee8df] text-[#171a21] border-black/8";
  }

  if (status === "Cancelled" || status === "Paused") {
    return "bg-[#f6f8fc] text-[#657187] border-black/8";
  }

  return "bg-white text-[#171a21] border-black/8";
}

function getDisplayStatus(status: string) {
  if (status === "Trigger Created") {
    return "Scheduled";
  }

  return status;
}

function getStatusIcon(status: string) {
  if (status === "Sent") return "check";
  if (status === "Scheduled") return "calendar";
  if (status === "Trigger Created") return "calendar";
  if (status === "Sending") return "refresh";
  if (status === "Failed") return "x";
  if (status === "Quota Blocked" || status === "Manual Review") return "warning";
  return "mail";
}

function StatBox({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: "calendar" | "gear" | "check" | "warning" | "mail";
  className: string;
}) {
  return (
    <div className={`rounded-[24px] p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="icon-box h-10 w-10 bg-white/85">
          <OutlineIcon name={icon} className="h-4 w-4" />
        </div>

        <p className="text-2xl font-semibold text-[#171a21]">{value}</p>
      </div>

      <p className="mt-3 text-sm font-semibold text-[#171a21]">{label}</p>
    </div>
  );
}

function InfoCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-[#f6f8fc] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
        {label}
      </p>
      <p className="mt-1 text-sm leading-5 text-[#171a21]">{value}</p>
    </div>
  );
}

export default function EmailsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

  const stats = useMemo(() => {
    const scheduled = emails.filter((email) =>
      ["Scheduled", "Trigger Created"].includes(email.status)
    ).length;

    const sending = emails.filter((email) => email.status === "Sending").length;

    const sent = emails.filter((email) => email.status === "Sent").length;

    const attention = emails.filter((email) =>
      ["Failed", "Quota Blocked", "Manual Review", "Auth Required"].includes(
        email.status
      )
    ).length;

    return {
      scheduled,
      sending,
      sent,
      attention,
      active: scheduled + sending,
    };
  }, [emails]);

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;

      setUserId(currentUserId);
      setUserEmail(data.session.user.email ?? null);

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
      "Cancel this scheduled email? MailMotive's recurring scheduler will skip it because the status will no longer be Scheduled."
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

  if (loading) {
    return (
      <AppShell activePage="emails" email={userEmail}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="soft-card bg-white p-8 text-center">
            <div className="icon-box mx-auto h-12 w-12 bg-[#dbe6ff]">
              <OutlineIcon name="mail" />
            </div>
            <p className="page-eyebrow mt-4">Emails</p>
            <h1 className="mt-2 text-2xl font-semibold text-black">
              Loading tracker
            </h1>
            <p className="mt-3 text-sm text-[#657187]">
              Fetching scheduled, sent, and failed email records.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="emails" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Operations tracker</p>
          <h1 className="page-title mt-2">Emails</h1>
          <p className="page-description">
            Track every outreach email from scheduling to recurring scheduler
            pickup, sending, delivery, failure, cancellation, and manual review.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadEmails()}
            className="btn btn-light"
            type="button"
          >
            <OutlineIcon name="refresh" className="mr-2 h-4 w-4" />
            Refresh
          </button>

          <Link href="/outreach/new" className="btn btn-dark">
            <OutlineIcon name="compose" className="mr-2 h-4 w-4" />
            New Outreach
          </Link>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="status-pill bg-[#dbe6ff]">
          {emails.length} total emails
        </span>
        <span className="status-pill bg-[#dcf5e7]">{stats.sent} sent</span>
        <span className="status-pill bg-[#f4dceb]">
          {stats.active} active
        </span>
        <span className="status-pill bg-white/80">
          {filteredEmails.length} visible
        </span>
      </div>

      {message ? (
        <div className="mt-6 rounded-[22px] border border-black/8 bg-white p-4">
          <p className="text-sm font-semibold text-[#171a21]">{message}</p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-5">
          <div className="soft-card bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Pipeline snapshot</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Current status
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Compact overview of the email states that matter most.
                </p>
              </div>

              <div className="icon-box h-12 w-12 bg-[#e5ebff]">
                <OutlineIcon name="gear" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatBox
                label="Scheduled"
                value={stats.scheduled}
                icon="calendar"
                className="bg-[#dbe6ff]"
              />

              <StatBox
                label="Sending"
                value={stats.sending}
                icon="gear"
                className="bg-[#f4dceb]"
              />

              <StatBox
                label="Sent"
                value={stats.sent}
                icon="check"
                className="bg-[#dcf5e7]"
              />

              <StatBox
                label="Attention"
                value={stats.attention}
                icon="warning"
                className="bg-[#eee8df]"
              />
            </div>
          </div>

          <div className="soft-card bg-[rgba(243,248,255,0.76)] p-6">
            <p className="page-eyebrow">Filters</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
              Find an email
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Search</label>
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="input"
                  placeholder="Professor, email, university, category, subject..."
                />
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("All");
                }}
                className="btn btn-light w-full"
                type="button"
              >
                Clear filters
              </button>
            </div>
          </div>

          <div className="soft-card bg-[#dcf5e7] p-5">
            <div className="flex items-start gap-3">
              <div className="icon-box h-10 w-10 bg-white/85">
                <OutlineIcon name="check" className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#171a21]">
                  Status flow
                </p>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Scheduled → Sending → Sent. Failed or blocked emails appear as
                  attention items. Old Trigger Created rows are shown as legacy
                  scheduled items.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="soft-card bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Email records</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                Delivery timeline
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#657187]">
                Showing {filteredEmails.length} of {emails.length} emails.
              </p>
            </div>

            <Link href="/followups" className="btn btn-light">
              <OutlineIcon name="repeat" className="mr-2 h-4 w-4" />
              Follow-ups
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {filteredEmails.length === 0 ? (
              <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-8 text-center">
                <div className="icon-box mx-auto h-12 w-12 bg-white">
                  <OutlineIcon name="mail" />
                </div>

                <p className="mt-4 text-sm font-semibold text-[#171a21]">
                  No emails found
                </p>

                <p className="mt-2 text-sm text-[#657187]">
                  Try clearing filters or create a new outreach email.
                </p>

                <Link href="/outreach/new" className="btn btn-dark mt-5">
                  New Outreach
                </Link>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <article
                  key={email.id}
                  className="rounded-[26px] border border-black/8 bg-[#f9fbff] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(
                            email.status
                          )}`}
                        >
                          <OutlineIcon
                            name={getStatusIcon(email.status)}
                            className="h-3.5 w-3.5"
                          />
                          {getDisplayStatus(email.status)}
                        </span>

                        {email.status === "Trigger Created" ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-xs font-semibold text-[#657187]">
                            Legacy status
                          </span>
                        ) : null}

                        {email.followup_required ? (
                          <span className="rounded-full border border-black/8 bg-[#dcf5e7] px-3 py-1 text-xs font-semibold text-[#171a21]">
                            Follow-up after {email.followup_after_days} days
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-4 break-words text-lg font-semibold leading-7 text-[#171a21]">
                        {email.subject}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-[#657187]">
                        {email.professors?.professor_name || "Unknown contact"}{" "}
                        · {email.professors?.email || "No email"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {email.professors?.university ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#657187]">
                            {email.professors.university}
                          </span>
                        ) : null}

                        {email.professors?.category ? (
                          <span className="rounded-full bg-[#dcf5e7] px-3 py-1 text-xs font-medium text-[#171a21]">
                            {email.professors.category}
                          </span>
                        ) : null}

                        {email.professors?.research_area ? (
                          <span className="rounded-full bg-[#dbe6ff] px-3 py-1 text-xs font-medium text-[#171a21]">
                            {email.professors.research_area}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {["Scheduled", "Trigger Created", "Quota Blocked"].includes(
                        email.status
                      ) ? (
                        <button
                          onClick={() => handleCancelEmail(email)}
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          type="button"
                        >
                          Cancel
                        </button>
                      ) : null}

                      {["Failed", "Quota Blocked"].includes(email.status) ? (
                        <button
                          onClick={() => handleMarkManualReview(email)}
                          className="rounded-full border border-black/8 bg-[#eee8df] px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#e4dbcf]"
                          type="button"
                        >
                          Manual Review
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <InfoCell
                      label="Scheduled"
                      value={formatDateTime(email.send_datetime)}
                    />

                    <InfoCell
                      label="Scheduler"
                      value={getSchedulerDisplay(email)}
                    />

                    <InfoCell label="Sent" value={getSentDisplay(email)} />

                    <InfoCell
                      label="Created"
                      value={formatDateTime(email.created_at)}
                    />
                  </div>

                  {email.trigger_note || email.blocked_reason || email.error ? (
                    <div className="mt-4 rounded-[22px] border border-black/8 bg-white p-4 text-sm">
                      {email.trigger_note ? (
                        <p className="text-[#657187]">
                          <span className="font-semibold text-[#171a21]">
                            Scheduler note:
                          </span>{" "}
                          {email.trigger_note}
                        </p>
                      ) : null}

                      {email.blocked_reason ? (
                        <p className="mt-2 text-[#9a5c00]">
                          <span className="font-semibold text-[#171a21]">
                            Blocked:
                          </span>{" "}
                          {email.blocked_reason}
                        </p>
                      ) : null}

                      {email.error ? (
                        <p className="mt-2 text-red-700">
                          <span className="font-semibold text-[#171a21]">
                            Error:
                          </span>{" "}
                          {email.error}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <details className="mt-4 rounded-[22px] border border-black/8 bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#171a21]">
                      Preview email body
                    </summary>

                    <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[#657187]">
                      {email.email_body}
                    </pre>
                  </details>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}