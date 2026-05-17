"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DashboardStats = {
  professors: number;
  files: number;
  scheduled: number;
  triggerCreated: number;
  sent: number;
  failed: number;
  quotaBlocked: number;
  manualReview: number;
};

const initialStats: DashboardStats = {
  professors: 0,
  files: 0,
  scheduled: 0,
  triggerCreated: 0,
  sent: 0,
  failed: 0,
  quotaBlocked: 0,
  manualReview: 0,
};

export default function DashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState("Checking session...");
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("Session error: " + error.message);
        return;
      }

      if (!data.session) {
        setStatus("No active session. Redirecting to login...");
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;

      setUserId(currentUserId);
      setEmail(data.session.user.email ?? null);
      setStatus("Session found.");

      await loadDashboardStats(currentUserId);
    }

    checkSession();
  }, [router]);

  async function getCount(
    table: string,
    currentUserId: string,
    statusValue?: string
  ) {
    let query = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId);

    if (statusValue) {
      query = query.eq("status", statusValue);
    }

    const { count, error } = await query;

    if (error) {
      console.error(`Count error for ${table}:`, error.message);
      return 0;
    }

    return count ?? 0;
  }

  async function loadDashboardStats(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    setLoadingStats(true);

    const [
      professorCount,
      fileCount,
      scheduledCount,
      triggerCreatedCount,
      sentCount,
      failedCount,
      quotaBlockedCount,
      manualReviewCount,
    ] = await Promise.all([
      getCount("professors", id),
      getCount("resume_files", id),
      getCount("email_messages", id, "Scheduled"),
      getCount("email_messages", id, "Trigger Created"),
      getCount("email_messages", id, "Sent"),
      getCount("email_messages", id, "Failed"),
      getCount("email_messages", id, "Quota Blocked"),
      getCount("email_messages", id, "Manual Review"),
    ]);

    setStats({
      professors: professorCount,
      files: fileCount,
      scheduled: scheduledCount,
      triggerCreated: triggerCreatedCount,
      sent: sentCount,
      failed: failedCount,
      quotaBlocked: quotaBlockedCount,
      manualReview: manualReviewCount,
    });

    setLoadingStats(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!email) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          {status}
        </div>
      </main>
    );
  }

  const problemCount = stats.failed + stats.quotaBlocked + stats.manualReview;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">MailMotive Dashboard</h1>
            <p className="mt-2 text-slate-400">Logged in as {email}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadDashboardStats()}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Professors</p>
            <h2 className="mt-2 text-3xl font-bold">
              {loadingStats ? "…" : stats.professors}
            </h2>
            <p className="mt-2 text-xs text-slate-500">Saved contacts</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Files</p>
            <h2 className="mt-2 text-3xl font-bold">
              {loadingStats ? "…" : stats.files}
            </h2>
            <p className="mt-2 text-xs text-slate-500">Uploaded attachments</p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-400/10 p-5">
            <p className="text-sm text-blue-200">Scheduled</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-100">
              {loadingStats ? "…" : stats.scheduled}
            </h2>
            <p className="mt-2 text-xs text-blue-200/70">
              Waiting for registration trigger
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-400/10 p-5">
            <p className="text-sm text-purple-200">Trigger Created</p>
            <h2 className="mt-2 text-3xl font-bold text-purple-100">
              {loadingStats ? "…" : stats.triggerCreated}
            </h2>
            <p className="mt-2 text-xs text-purple-200/70">
              Waiting for send time
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-400/10 p-5">
            <p className="text-sm text-emerald-200">Sent</p>
            <h2 className="mt-2 text-3xl font-bold text-emerald-100">
              {loadingStats ? "…" : stats.sent}
            </h2>
            <p className="mt-2 text-xs text-emerald-200/70">
              Successfully delivered to Gmail
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-400/10 p-5">
            <p className="text-sm text-red-200">Failed</p>
            <h2 className="mt-2 text-3xl font-bold text-red-100">
              {loadingStats ? "…" : stats.failed}
            </h2>
            <p className="mt-2 text-xs text-red-200/70">Needs investigation</p>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-400/10 p-5">
            <p className="text-sm text-orange-200">Quota Blocked</p>
            <h2 className="mt-2 text-3xl font-bold text-orange-100">
              {loadingStats ? "…" : stats.quotaBlocked}
            </h2>
            <p className="mt-2 text-xs text-orange-200/70">
              Paused by sending limits
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Needs Attention</p>
            <h2 className="mt-2 text-3xl font-bold">
              {loadingStats ? "…" : problemCount}
            </h2>
            <p className="mt-2 text-xs text-slate-500">
              Failed + blocked + manual review
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <p className="mt-2 text-slate-400">
            Manage contacts, schedule outreach emails, upload files, and track
            the sending lifecycle.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/professors"
              className="rounded-xl bg-emerald-400 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Manage Professors
            </Link>

            <Link
              href="/outreach/new"
              className="rounded-xl bg-blue-400 px-4 py-2 font-semibold text-slate-950 hover:bg-blue-300"
            >
              New Outreach
            </Link>

            <Link
              href="/emails"
              className="rounded-xl bg-purple-400 px-4 py-2 font-semibold text-slate-950 hover:bg-purple-300"
            >
              Track Emails
            </Link>

            <Link
              href="/resumes"
              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Manage Files
            </Link>
            <Link
  href="/followups"
  className="rounded-xl bg-orange-400 px-4 py-2 font-semibold text-slate-950 hover:bg-orange-300"
>
  Follow-ups
</Link>
            <Link
              href="/test-supabase"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-950"
            >
              Supabase Test
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}