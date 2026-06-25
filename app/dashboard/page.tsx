"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";
import { supabase } from "@/lib/supabaseClient";

type IconName = ComponentProps<typeof OutlineIcon>["name"];

type DashboardStats = {
  professors: number;
  files: number;
  scheduled: number;
  sending: number;
  sent: number;
  failed: number;
  quotaBlocked: number;
  manualReview: number;
};

const initialStats: DashboardStats = {
  professors: 0,
  files: 0,
  scheduled: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  quotaBlocked: 0,
  manualReview: 0,
};

function StageRow({
  title,
  note,
  value,
  icon,
  bg,
  bar,
}: {
  title: string;
  note: string;
  value: number;
  icon: IconName;
  bg: string;
  bar: string;
}) {
  const width = Math.min(100, Math.max(12, value * 16));

  return (
    <div className={`rounded-[22px] ${bg} p-4`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="icon-box h-10 w-10 bg-white/85">
            <OutlineIcon name={icon} className="h-4 w-4" />
          </div>

          <div>
            <p className="text-sm font-semibold text-[#171a21]">{title}</p>
            <p className="text-xs text-[#667389]">{note}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/82 px-3 py-2 text-center">
          <p className="text-xl font-semibold text-[#171a21]">{value}</p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-black/8">
        <div
          className={`h-2 rounded-full ${bar}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

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
        setLoadingStats(false);
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

  async function getCount(table: string, currentUserId: string) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId);

    if (error) {
      console.error(`Count error for ${table}:`, error.message);
      return 0;
    }

    return count ?? 0;
  }

  async function getEmailStatusCount(
    currentUserId: string,
    statuses: string[]
  ) {
    const { count, error } = await supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", currentUserId)
      .in("status", statuses);

    if (error) {
      console.error("Email status count error:", error.message);
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
      sendingCount,
      sentCount,
      failedCount,
      quotaBlockedCount,
      manualReviewCount,
    ] = await Promise.all([
      getCount("professors", id),
      getCount("resume_files", id),

      // Trigger Created is counted only as legacy scheduled/queued work.
      getEmailStatusCount(id, ["Scheduled", "Trigger Created"]),

      getEmailStatusCount(id, ["Sending"]),
      getEmailStatusCount(id, ["Sent"]),
      getEmailStatusCount(id, ["Failed"]),
      getEmailStatusCount(id, ["Quota Blocked"]),
      getEmailStatusCount(id, ["Manual Review"]),
    ]);

    setStats({
      professors: professorCount,
      files: fileCount,
      scheduled: scheduledCount,
      sending: sendingCount,
      sent: sentCount,
      failed: failedCount,
      quotaBlocked: quotaBlockedCount,
      manualReview: manualReviewCount,
    });

    setLoadingStats(false);
  }

  const attentionCount = stats.failed + stats.quotaBlocked + stats.manualReview;
  const activePipeline = stats.scheduled + stats.sending;

  const quickActions = [
    {
      title: "New Outreach",
      text: "Compose, attach files, and schedule a fresh email.",
      href: "/outreach/new",
      icon: "compose" as IconName,
      bg: "bg-[#dbe6ff]",
      large: true,
    },
    {
      title: "Track Emails",
      text: "Monitor scheduled, sending, sent, and failed messages.",
      href: "/emails",
      icon: "mail" as IconName,
      bg: "bg-[#f4dceb]",
      large: false,
    },
    {
      title: "Follow-ups",
      text: "Handle no-reply cases and next steps.",
      href: "/followups",
      icon: "repeat" as IconName,
      bg: "bg-[#caf8ff]",
      large: false,
    },
    {
      title: "Contacts",
      text: "Manage professors, recruiters, and HR targets.",
      href: "/professors",
      icon: "people" as IconName,
      bg: "bg-[#d8f4e4]",
      large: false,
    },
    {
      title: "Files",
      text: "Upload and organize resumes or attachments.",
      href: "/resumes",
      icon: "file" as IconName,
      bg: "bg-[#ecdeff]",
      large: false,
    },
    {
      title: "System Test",
      text: "Verify Supabase connection health.",
      href: "/test-supabase",
      icon: "test" as IconName,
      bg: "bg-[#f6f8fc]",
      large: false,
    },
  ];

  const stages = useMemo(
    () => [
      {
        title: "Scheduled",
        note: "waiting for recurring scheduler",
        value: stats.scheduled,
        icon: "calendar" as IconName,
        bg: "bg-[#e5ebff]",
        bar: "bg-[#a5b2e8]",
      },
      {
        title: "Sending",
        note: "picked by scheduler",
        value: stats.sending,
        icon: "refresh" as IconName,
        bg: "bg-[#f4dcec]",
        bar: "bg-[#e69ccd]",
      },
      {
        title: "Sent",
        note: "successfully delivered",
        value: stats.sent,
        icon: "check" as IconName,
        bg: "bg-[#dcf5e7]",
        bar: "bg-[#9bffc7]",
      },
      {
        title: "Attention",
        note: "failed, blocked, or review needed",
        value: attentionCount,
        icon: "warning" as IconName,
        bg: "bg-[#eee8df]",
        bar: "bg-[#d7c3a8]",
      },
    ],
    [stats, attentionCount]
  );

  if (!email) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="soft-card bg-white p-8 text-center">
          <div className="icon-box mx-auto h-12 w-12 bg-[#dbe6ff]">
            <OutlineIcon name="dashboard" />
          </div>

          <p className="page-eyebrow mt-4">MailMotive</p>

          <h1 className="mt-2 text-2xl font-semibold text-black">
            Preparing workspace
          </h1>

          <p className="mt-3 text-sm text-neutral-500">{status}</p>
        </div>
      </main>
    );
  }

  return (
    <AppShell activePage="dashboard" email={email}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Personal outreach system</p>

          <h1 className="page-title mt-2">Outreach Command Center</h1>

          <p className="page-description">
            Manage applications, cold emails, professor outreach, recruiter
            contact, and follow-ups from one organized workspace.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadDashboardStats()}
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
        <span className="status-pill bg-[#dbe6ff]">Cool UI theme</span>
        <span className="status-pill bg-[#dcf5e7]">Gmail automation</span>
        <span className="status-pill bg-[#f4dceb]">Follow-up workflow</span>
        <span className="status-pill bg-white/80">
          15-minute scheduler
        </span>
        <span className="status-pill bg-white/80">
          {loadingStats ? "..." : activePipeline} active
        </span>
      </div>

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.22fr_0.78fr]">
        <div className="soft-card bg-[rgba(243,248,255,0.76)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="page-eyebrow">Action hub</p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                What do you want to do next?
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-[#657187]">
                Create new outreach, continue follow-ups, open contacts, and
                manage files.
              </p>
            </div>

            <Link href="/outreach/new" className="btn btn-dark">
              New Outreach
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {quickActions.map((action, index) => (
              <Link
                key={action.title}
                href={action.href}
                className={`action-link ${action.bg} p-5 ${
                  action.large ? "md:col-span-2" : ""
                }`}
              >
                <div className="flex h-full flex-col justify-between gap-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="icon-box h-12 w-12 bg-white/82">
                      <OutlineIcon name={action.icon} />
                    </div>

                    {index === 0 ? (
                      <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                        Primary
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#171a21]">
                      {action.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#5e6c83]">
                      {action.text}
                    </p>
                  </div>

                  {action.large ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#171a21]">
                        Start composing now
                      </span>

                      <span className="text-sm font-semibold text-[#171a21]">
                        Open →
                      </span>
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <aside className="soft-card bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="page-eyebrow">Operations overview</p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                System status
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#657187]">
                A monitoring panel for the current email pipeline and workspace
                readiness.
              </p>
            </div>

            <div className="icon-box h-12 w-12 bg-[#e5ebff]">
              <OutlineIcon name="gear" />
            </div>
          </div>

          <div className="mt-6 rounded-[24px] bg-[#eef4ff] p-5">
            <p className="text-sm font-medium text-[#60708a]">
              Emails in motion
            </p>

            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-4xl font-semibold text-[#171a21]">
                {loadingStats ? "..." : activePipeline}
              </p>

              <p className="text-sm text-[#657187]">
                scheduled + sending
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {stages.map((stage) => (
              <StageRow
                key={stage.title}
                title={stage.title}
                note={stage.note}
                value={loadingStats ? 0 : stage.value}
                icon={stage.icon}
                bg={stage.bg}
                bar={stage.bar}
              />
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-black/8 bg-[#dcf5e7] p-4">
              <p className="text-2xl font-semibold text-[#171a21]">
                {loadingStats ? "..." : stats.professors}
              </p>

              <p className="mt-1 text-xs font-medium text-[#5f6b80]">
                saved contacts
              </p>
            </div>

            <div className="rounded-[22px] border border-black/8 bg-[#eef3d9] p-4">
              <p className="text-2xl font-semibold text-[#171a21]">
                {loadingStats ? "..." : stats.files}
              </p>

              <p className="mt-1 text-xs font-medium text-[#5f6b80]">
                uploaded files
              </p>
            </div>
          </div>

          {attentionCount > 0 ? (
            <Link
              href="/emails"
              className="mt-5 flex items-center justify-between rounded-[22px] border border-black/8 bg-[#fff2d8] p-4 transition hover:bg-[#ffedc7]"
            >
              <div>
                <p className="text-sm font-semibold text-[#171a21]">
                  Review recommended
                </p>

                <p className="mt-1 text-xs text-[#657187]">
                  Some items may need your attention.
                </p>
              </div>

              <span className="text-sm font-semibold text-[#171a21]">
                Open
              </span>
            </Link>
          ) : (
            <div className="mt-5 rounded-[22px] border border-black/8 bg-[#e6f8ed] p-4">
              <p className="text-sm font-semibold text-[#171a21]">
                No urgent issues
              </p>

              <p className="mt-1 text-xs text-[#657187]">
                Failed, blocked, and review counts are currently clear.
              </p>
            </div>
          )}
        </aside>
      </section>
    </AppShell>
  );
}