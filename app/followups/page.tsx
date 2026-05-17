"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProfessorInfo = {
  professor_name: string;
  email: string;
  university: string | null;
  category: string | null;
  research_area: string | null;
  reply_status: string;
};

type OriginalEmail = {
  id: string;
  user_id: string;
  professor_id: string;
  subject: string;
  email_body: string;
  send_datetime: string;
  status: string;
  sent_time: string | null;
  followup_required: boolean;
  followup_after_days: number;
  created_at: string;
  email_kind: string | null;
  parent_email_id: string | null;
  professors: ProfessorInfo | null;
};

type ChildEmail = {
  id: string;
  parent_email_id: string | null;
  subject: string;
  email_body: string;
  send_datetime: string;
  status: string;
  sent_time: string | null;
  email_kind: string | null;
  created_at: string;
};

type FollowupTemplate = {
  id: string;
  label: string;
  subject: string;
  email_body: string;
};

type BoardItem = OriginalEmail & {
  followupEmails: ChildEmail[];
  customReplyEmails: ChildEmail[];
};

type ComposerMode = "followup" | "custom_reply";

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function getFollowupDueDate(email: OriginalEmail) {
  if (!email.sent_time) return null;

  const sentDate = new Date(email.sent_time);

  if (Number.isNaN(sentDate.getTime())) return null;

  return new Date(
    sentDate.getTime() + email.followup_after_days * 24 * 60 * 60 * 1000
  );
}

function getReminderStatus(email: OriginalEmail) {
  const dueDate = getFollowupDueDate(email);

  if (!dueDate) return "No sent time";

  if (dueDate <= new Date()) return "Due";

  return "Upcoming";
}

function getReplyStatus(item: BoardItem) {
  return item.professors?.reply_status || "No Reply";
}

function hasReply(item: BoardItem) {
  const replyStatus = getReplyStatus(item);

  return ["Replied", "Positive", "Rejected", "Closed"].includes(replyStatus);
}

function getBadgeClass(status: string) {
  if (status === "Due") {
    return "border-orange-500/30 bg-orange-400/10 text-orange-300";
  }

  if (status === "Upcoming") {
    return "border-blue-500/30 bg-blue-400/10 text-blue-300";
  }

  if (status === "Positive") {
    return "border-emerald-500/30 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "Replied") {
    return "border-cyan-500/30 bg-cyan-400/10 text-cyan-300";
  }

  if (status === "Rejected") {
    return "border-red-500/30 bg-red-400/10 text-red-300";
  }

  if (status === "Closed") {
    return "border-slate-600 bg-slate-800 text-slate-300";
  }

  if (status === "Sent") {
    return "border-emerald-500/30 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "Scheduled") {
    return "border-blue-500/30 bg-blue-400/10 text-blue-300";
  }

  if (status === "Trigger Created") {
    return "border-purple-500/30 bg-purple-400/10 text-purple-300";
  }

  if (status === "Failed") {
    return "border-red-500/30 bg-red-400/10 text-red-300";
  }

  if (status === "No Reply") {
    return "border-slate-700 bg-slate-800 text-slate-300";
  }

  return "border-slate-700 bg-slate-800 text-slate-300";
}

export default function FollowupsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [templates, setTemplates] = useState<FollowupTemplate[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [searchText, setSearchText] = useState("");

  const [activeEmail, setActiveEmail] = useState<BoardItem | null>(null);
  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTemplateLabel, setNewTemplateLabel] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replySendDatetime, setReplySendDatetime] = useState("");
  const [savingComposer, setSavingComposer] = useState(false);

  const replyReceivedItems = useMemo(() => {
    return items.filter(
      (item) => hasReply(item) && matchesSearch(item, searchText)
    );
  }, [items, searchText]);

  const followupScheduledItems = useMemo(() => {
    return items.filter((item) => {
      const hasFollowup = item.followupEmails.length > 0;
      return !hasReply(item) && hasFollowup && matchesSearch(item, searchText);
    });
  }, [items, searchText]);

  const noReplyYetItems = useMemo(() => {
    return items.filter((item) => {
      const hasFollowup = item.followupEmails.length > 0;
      return !hasReply(item) && !hasFollowup && matchesSearch(item, searchText);
    });
  }, [items, searchText]);

  useEffect(() => {
    async function initialize() {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMessage("Session error: " + error.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;
      setUserId(currentUserId);

      await Promise.all([
        loadBoardItems(currentUserId),
        loadFollowupTemplates(currentUserId),
      ]);

      setLoading(false);
    }

    initialize();
  }, [router]);

  function matchesSearch(item: BoardItem, textInput: string) {
    const text = textInput.toLowerCase().trim();

    if (!text) return true;

    return (
      item.subject.toLowerCase().includes(text) ||
      item.professors?.professor_name?.toLowerCase().includes(text) ||
      item.professors?.email?.toLowerCase().includes(text) ||
      item.professors?.university?.toLowerCase().includes(text) ||
      item.professors?.category?.toLowerCase().includes(text) ||
      item.professors?.research_area?.toLowerCase().includes(text)
    );
  }

  async function loadBoardItems(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    const { data: originals, error: originalsError } = await supabase
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
        followup_required,
        followup_after_days,
        created_at,
        email_kind,
        parent_email_id,
        professors (
          professor_name,
          email,
          university,
          category,
          research_area,
          reply_status
        )
      `
      )
      .eq("user_id", id)
      .eq("followup_required", true)
      .is("parent_email_id", null)
      .in("status", ["Sent", "Replied", "Followup Needed", "Closed"])
      .order("sent_time", { ascending: false });

    if (originalsError) {
      setMessage("Error loading follow-up board: " + originalsError.message);
      return;
    }

    const originalRows = (originals ?? []) as unknown as OriginalEmail[];
    const originalIds = originalRows.map((row) => row.id);

    let childRows: ChildEmail[] = [];

    if (originalIds.length > 0) {
      const { data: children, error: childrenError } = await supabase
        .from("email_messages")
        .select(
          `
          id,
          parent_email_id,
          subject,
          email_body,
          send_datetime,
          status,
          sent_time,
          email_kind,
          created_at
        `
        )
        .eq("user_id", id)
        .in("parent_email_id", originalIds)
        .order("created_at", { ascending: false });

      if (childrenError) {
        setMessage("Error loading linked emails: " + childrenError.message);
        return;
      }

      childRows = (children ?? []) as unknown as ChildEmail[];
    }

    const boardItems: BoardItem[] = originalRows.map((original) => {
      const linked = childRows.filter(
        (child) => child.parent_email_id === original.id
      );

      return {
        ...original,
        followupEmails: linked.filter(
          (child) => child.email_kind === "followup"
        ),
        customReplyEmails: linked.filter(
          (child) => child.email_kind === "custom_reply"
        ),
      };
    });

    setItems(boardItems);
  }

  async function loadFollowupTemplates(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    const { data, error } = await supabase
      .from("followup_templates")
      .select("id,label,subject,email_body")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading follow-up templates: " + error.message);
      return;
    }

    setTemplates(data ?? []);
  }

  function getMinimumSafeDate() {
    const now = new Date();
    return new Date(now.getTime() + 35 * 60 * 1000);
  }

  function getMinimumDatetimeLocal() {
    const minimum = getMinimumSafeDate();

    const year = minimum.getFullYear();
    const month = String(minimum.getMonth() + 1).padStart(2, "0");
    const day = String(minimum.getDate()).padStart(2, "0");
    const hours = String(minimum.getHours()).padStart(2, "0");
    const minutes = String(minimum.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  async function addEvent(
    emailId: string,
    currentUserId: string,
    eventType: string,
    note: string
  ) {
    const { error } = await supabase.from("email_events").insert({
      user_id: currentUserId,
      email_message_id: emailId,
      event_type: eventType,
      event_note: note,
    });

    if (error) {
      console.error("Event logging failed:", error.message);
    }
  }

  async function updateOutcome(
    item: BoardItem,
    replyStatus: "Replied" | "Positive" | "Rejected" | "Closed",
    closeEmail: boolean
  ) {
    const { error: professorError } = await supabase
      .from("professors")
      .update({
        reply_status: replyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.professor_id);

    if (professorError) {
      setMessage("Professor update failed: " + professorError.message);
      return;
    }

    const emailStatus = closeEmail ? "Closed" : "Replied";

    const { error: emailError } = await supabase
      .from("email_messages")
      .update({
        status: emailStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (emailError) {
      setMessage("Email update failed: " + emailError.message);
      return;
    }

    await addEvent(
      item.id,
      item.user_id,
      replyStatus,
      closeEmail
        ? `Marked ${replyStatus} and closed.`
        : `Marked ${replyStatus}.`
    );

    setMessage(
      closeEmail
        ? `Marked ${replyStatus} and closed.`
        : `Marked ${replyStatus}.`
    );

    await loadBoardItems();
  }

  async function markAsNoReply(item: BoardItem) {
    const confirmed = window.confirm(
      "Move this record back to No Reply? This will undo the reply label and return it to the no-reply follow-up workflow."
    );

    if (!confirmed) return;

    const { error: professorError } = await supabase
      .from("professors")
      .update({
        reply_status: "No Reply",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.professor_id);

    if (professorError) {
      setMessage("Professor update failed: " + professorError.message);
      return;
    }

    const { error: emailError } = await supabase
      .from("email_messages")
      .update({
        status: "Sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (emailError) {
      setMessage("Email update failed: " + emailError.message);
      return;
    }

    await addEvent(
      item.id,
      item.user_id,
      "No Reply",
      "Reply status was reset manually to No Reply."
    );

    setMessage("Moved back to No Reply.");
    await loadBoardItems();
  }

  async function openPositiveReply(item: BoardItem) {
    await updateOutcome(item, "Positive", false);
    openComposer(item, "custom_reply", "Re: " + item.subject, "");
  }

  async function openRepliedReply(item: BoardItem) {
    await updateOutcome(item, "Replied", false);
    openComposer(item, "custom_reply", "Re: " + item.subject, "");
  }

  function openComposer(
    item: BoardItem,
    mode: ComposerMode,
    subjectPreset?: string,
    bodyPreset?: string
  ) {
    setActiveEmail(item);
    setComposerMode(mode);
    setSelectedTemplateId("");
    setNewTemplateLabel("");
    setReplySubject(subjectPreset ?? "");
    setReplyBody(bodyPreset ?? "");
    setReplySendDatetime("");
    setMessage("");
  }

  function openFollowupComposer(item: BoardItem) {
    openComposer(item, "followup", "Follow-up: " + item.subject, "");
  }

  function closeComposer() {
    setActiveEmail(null);
    setComposerMode(null);
    setSelectedTemplateId("");
    setNewTemplateLabel("");
    setReplySubject("");
    setReplyBody("");
    setReplySendDatetime("");
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);

    if (templateId === "__new__") {
      setReplySubject("");
      setReplyBody("");
      return;
    }

    const template = templates.find((item) => item.id === templateId);

    if (template) {
      setReplySubject(template.subject);
      setReplyBody(template.email_body);
    }
  }

  async function handleScheduleComposer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId || !activeEmail || !composerMode) {
      setMessage("Missing user or selected email.");
      return;
    }

    if (!replySubject.trim()) {
      setMessage("Subject is required.");
      return;
    }

    if (!replyBody.trim()) {
      setMessage("Email body is required.");
      return;
    }

    if (!replySendDatetime) {
      alert("Please choose a scheduled date and time.");
      setMessage("Please choose scheduled date and time.");
      return;
    }

    const scheduledDate = new Date(replySendDatetime);

    if (Number.isNaN(scheduledDate.getTime())) {
      alert("Invalid scheduled date/time.");
      setMessage("Invalid scheduled date/time.");
      return;
    }

    const minimumSafeTime = getMinimumSafeDate();

    if (scheduledDate < minimumSafeTime) {
      const warningMessage =
        "Invalid scheduled time.\n\n" +
        "MailMotive checks new scheduled emails every 30 minutes.\n" +
        "Please choose a send time at least 35 minutes from now.\n\n" +
        `Earliest safe time: ${minimumSafeTime.toLocaleString()}`;

      alert(warningMessage);
      setMessage(
        `Invalid scheduled time. Earliest safe time: ${minimumSafeTime.toLocaleString()}`
      );
      return;
    }

    setSavingComposer(true);
    setMessage("");

    try {
      if (composerMode === "followup" && selectedTemplateId === "__new__") {
        const { error: templateError } = await supabase
          .from("followup_templates")
          .insert({
            user_id: userId,
            label:
              newTemplateLabel.trim() ||
              replySubject.trim().slice(0, 45) ||
              "Follow-up template",
            subject: replySubject.trim(),
            email_body: replyBody.trim(),
          });

        if (templateError) {
          throw new Error("Template insert failed: " + templateError.message);
        }
      }

      const { data: newEmail, error: emailError } = await supabase
        .from("email_messages")
        .insert({
          user_id: userId,
          professor_id: activeEmail.professor_id,
          subject: replySubject.trim(),
          email_body: replyBody.trim(),
          send_datetime: scheduledDate.toISOString(),
          status: "Scheduled",
          followup_required: composerMode === "followup",
          followup_after_days: activeEmail.followup_after_days || 7,
          parent_email_id: activeEmail.id,
          email_kind:
            composerMode === "followup" ? "followup" : "custom_reply",
        })
        .select("id")
        .single();

      if (emailError) {
        throw new Error("Email scheduling failed: " + emailError.message);
      }

      if (!newEmail?.id) {
        throw new Error("Email scheduling failed: no email ID returned.");
      }

      await addEvent(
        newEmail.id,
        userId,
        composerMode === "followup"
          ? "Follow-up Scheduled"
          : "Custom Reply Scheduled",
        `Created from original email ${activeEmail.id}.`
      );

      await addEvent(
        activeEmail.id,
        userId,
        composerMode === "followup"
          ? "Follow-up Created"
          : "Custom Reply Created",
        `Created linked email ${newEmail.id}.`
      );

      if (composerMode === "followup") {
        await supabase
          .from("email_messages")
          .update({
            status: "Followup Needed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", activeEmail.id);
      }

      setMessage(
        composerMode === "followup"
          ? "Follow-up email scheduled successfully."
          : "Custom reply scheduled successfully."
      );

      closeComposer();

      await Promise.all([loadBoardItems(userId), loadFollowupTemplates(userId)]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong.";

      setMessage(errorMessage);
    } finally {
      setSavingComposer(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading follow-up board...
      </main>
    );
  }

  const totalDue = noReplyYetItems.filter(
    (item) => getReminderStatus(item) === "Due"
  ).length;

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Follow-up Workflow Board</h1>
            <p className="mt-2 text-slate-400">
              Reminder active means MailMotive should remind you after the chosen
              number of days. It does not mean a follow-up email is already
              scheduled.
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
              href="/emails"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Emails
            </Link>

            <Link
              href="/outreach/new"
              className="rounded-xl bg-blue-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-300"
            >
              New Outreach
            </Link>

            <button
              onClick={() => loadBoardItems()}
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

        {message && (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
            {message}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-400/10 p-5">
            <p className="text-sm text-cyan-200">Reply received</p>
            <h2 className="mt-2 text-3xl font-bold text-cyan-100">
              {replyReceivedItems.length}
            </h2>
            <p className="mt-2 text-xs text-cyan-200/70">
              Needs custom reply or closure
            </p>
          </div>

          <div className="rounded-2xl border border-orange-500/20 bg-orange-400/10 p-5">
            <p className="text-sm text-orange-200">Due now</p>
            <h2 className="mt-2 text-3xl font-bold text-orange-100">
              {totalDue}
            </h2>
            <p className="mt-2 text-xs text-orange-200/70">
              Reminder date has passed
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-400/10 p-5">
            <p className="text-sm text-blue-200">No reply yet</p>
            <h2 className="mt-2 text-3xl font-bold text-blue-100">
              {noReplyYetItems.length}
            </h2>
            <p className="mt-2 text-xs text-blue-200/70">
              No linked follow-up email
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-400/10 p-5">
            <p className="text-sm text-purple-200">Follow-up scheduled</p>
            <h2 className="mt-2 text-3xl font-bold text-purple-100">
              {followupScheduledItems.length}
            </h2>
            <p className="mt-2 text-xs text-purple-200/70">
              Actual follow-up email exists
            </p>
          </div>
        </section>

        {activeEmail && composerMode && (
          <section className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-400/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {composerMode === "followup"
                    ? "Schedule Follow-up from Template"
                    : "Write Custom Reply"}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  To: {activeEmail.professors?.professor_name} —{" "}
                  {activeEmail.professors?.email}
                </p>
              </div>

              <button
                type="button"
                onClick={closeComposer}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleScheduleComposer} className="mt-6 space-y-4">
              {composerMode === "followup" && (
                <div>
                  <label className="mb-1 block text-sm text-slate-300">
                    Follow-up template
                  </label>

                  <select
                    value={selectedTemplateId}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  >
                    <option value="">Choose saved follow-up template...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.label}
                      </option>
                    ))}
                    <option value="__new__">+ Add new follow-up template</option>
                  </select>
                </div>
              )}

              {composerMode === "followup" &&
                selectedTemplateId === "__new__" && (
                  <div>
                    <label className="mb-1 block text-sm text-slate-300">
                      New template label
                    </label>

                    <input
                      value={newTemplateLabel}
                      onChange={(e) => setNewTemplateLabel(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                      placeholder="Polite follow-up, Short follow-up..."
                    />
                  </div>
                )}

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Subject
                </label>

                <input
                  required
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Email body
                </label>

                <textarea
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="min-h-56 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Dear Professor..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Send date and time
                </label>

                <input
                  required
                  type="datetime-local"
                  min={getMinimumDatetimeLocal()}
                  value={replySendDatetime}
                  onChange={(e) => setReplySendDatetime(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Choose at least 35 minutes from now because registration runs
                  every 30 minutes.
                </p>
              </div>

              <button
                disabled={savingComposer}
                className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
              >
                {savingComposer
                  ? "Scheduling..."
                  : composerMode === "followup"
                  ? "Schedule Follow-up"
                  : "Schedule Custom Reply"}
              </button>
            </form>
          </section>
        )}

        <section className="mt-8">
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-emerald-400"
            placeholder="Search professor, email, university, category, research area, subject..."
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-3">
          <WorkflowColumn
            title="Reply received"
            description="Professor already replied. Send custom response, undo label, or close."
            emptyText="No replied records."
            items={replyReceivedItems}
            columnType="reply_received"
            onPositiveReply={openPositiveReply}
            onRepliedReply={openRepliedReply}
            onRepliedClose={(item) => updateOutcome(item, "Replied", true)}
            onRejectedClose={(item) => updateOutcome(item, "Rejected", true)}
            onClose={(item) => updateOutcome(item, "Closed", true)}
            onScheduleFollowup={openFollowupComposer}
            onMarkNoReply={markAsNoReply}
          />

          <WorkflowColumn
            title="No reply yet"
            description="Reminder is active, but no actual follow-up email has been created."
            emptyText="No no-reply records."
            items={noReplyYetItems}
            columnType="no_reply"
            onPositiveReply={openPositiveReply}
            onRepliedReply={openRepliedReply}
            onRepliedClose={(item) => updateOutcome(item, "Replied", true)}
            onRejectedClose={(item) => updateOutcome(item, "Rejected", true)}
            onClose={(item) => updateOutcome(item, "Closed", true)}
            onScheduleFollowup={openFollowupComposer}
            onMarkNoReply={markAsNoReply}
          />

          <WorkflowColumn
            title="Follow-up scheduled"
            description="An actual linked follow-up email exists. Track it here."
            emptyText="No scheduled follow-up records."
            items={followupScheduledItems}
            columnType="followup_scheduled"
            onPositiveReply={openPositiveReply}
            onRepliedReply={openRepliedReply}
            onRepliedClose={(item) => updateOutcome(item, "Replied", true)}
            onRejectedClose={(item) => updateOutcome(item, "Rejected", true)}
            onClose={(item) => updateOutcome(item, "Closed", true)}
            onScheduleFollowup={openFollowupComposer}
            onMarkNoReply={markAsNoReply}
          />
        </section>
      </div>
    </main>
  );
}

function WorkflowColumn({
  title,
  description,
  emptyText,
  items,
  columnType,
  onPositiveReply,
  onRepliedReply,
  onRepliedClose,
  onRejectedClose,
  onClose,
  onScheduleFollowup,
  onMarkNoReply,
}: {
  title: string;
  description: string;
  emptyText: string;
  items: BoardItem[];
  columnType: "reply_received" | "no_reply" | "followup_scheduled";
  onPositiveReply: (item: BoardItem) => void;
  onRepliedReply: (item: BoardItem) => void;
  onRepliedClose: (item: BoardItem) => void;
  onRejectedClose: (item: BoardItem) => void;
  onClose: (item: BoardItem) => void;
  onScheduleFollowup: (item: BoardItem) => void;
  onMarkNoReply: (item: BoardItem) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-400">{description}</p>

      <div className="mt-5 space-y-4">
        {items.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">
            {emptyText}
          </div>
        ) : (
          items.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              columnType={columnType}
              onPositiveReply={onPositiveReply}
              onRepliedReply={onRepliedReply}
              onRepliedClose={onRepliedClose}
              onRejectedClose={onRejectedClose}
              onClose={onClose}
              onScheduleFollowup={onScheduleFollowup}
              onMarkNoReply={onMarkNoReply}
            />
          ))
        )}
      </div>
    </div>
  );
}

function BoardCard({
  item,
  columnType,
  onPositiveReply,
  onRepliedReply,
  onRepliedClose,
  onRejectedClose,
  onClose,
  onScheduleFollowup,
  onMarkNoReply,
}: {
  item: BoardItem;
  columnType: "reply_received" | "no_reply" | "followup_scheduled";
  onPositiveReply: (item: BoardItem) => void;
  onRepliedReply: (item: BoardItem) => void;
  onRepliedClose: (item: BoardItem) => void;
  onRejectedClose: (item: BoardItem) => void;
  onClose: (item: BoardItem) => void;
  onScheduleFollowup: (item: BoardItem) => void;
  onMarkNoReply: (item: BoardItem) => void;
}) {
  const reminderStatus = getReminderStatus(item);
  const replyStatus = getReplyStatus(item);
  const dueDate = getFollowupDueDate(item);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {columnType === "reply_received" ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeClass(
              replyStatus
            )}`}
          >
            {replyStatus}
          </span>
        ) : (
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getBadgeClass(
              reminderStatus
            )}`}
          >
            Reminder: {reminderStatus}
          </span>
        )}

        <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300">
          Original: {item.status}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-semibold">{item.subject}</h3>

      <p className="mt-1 text-sm text-slate-400">
        {item.professors?.professor_name || "Unknown professor"} —{" "}
        {item.professors?.email || "No email"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {item.professors?.university && (
          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
            {item.professors.university}
          </span>
        )}

        {item.professors?.category && (
          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
            {item.professors.category}
          </span>
        )}

        {item.professors?.research_area && (
          <span className="rounded-full bg-blue-400/10 px-3 py-1 text-blue-300">
            {item.professors.research_area}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Original sent</p>
          <p className="mt-1 text-slate-300">
            {formatDateTime(item.sent_time)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">
            {columnType === "reply_received" ? "Reply state" : "Reminder due"}
          </p>
          <p className="mt-1 text-slate-300">
            {columnType === "reply_received"
              ? "Reply received — use custom reply, undo, or close"
              : dueDate
              ? formatDateTime(dueDate.toISOString())
              : "—"}
          </p>
        </div>
      </div>

      {item.followupEmails.length > 0 && (
        <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-400/10 p-4">
          <p className="text-sm font-semibold text-purple-200">
            Linked follow-up email
          </p>

          {item.followupEmails.map((email) => (
            <div key={email.id} className="mt-3 text-sm text-slate-300">
              <span
                className={`mr-2 rounded-full border px-2 py-0.5 text-xs ${getBadgeClass(
                  email.status
                )}`}
              >
                {email.status}
              </span>
              {email.subject}
              <p className="mt-1 text-xs text-slate-500">
                Scheduled: {formatDateTime(email.send_datetime)} | Sent:{" "}
                {formatDateTime(email.sent_time)}
              </p>
            </div>
          ))}
        </div>
      )}

      {item.customReplyEmails.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-400/10 p-4">
          <p className="text-sm font-semibold text-blue-200">
            Custom replies created
          </p>

          {item.customReplyEmails.map((email) => (
            <div key={email.id} className="mt-3 text-sm text-slate-300">
              <span
                className={`mr-2 rounded-full border px-2 py-0.5 text-xs ${getBadgeClass(
                  email.status
                )}`}
              >
                {email.status}
              </span>
              {email.subject}
              <p className="mt-1 text-xs text-slate-500">
                Scheduled: {formatDateTime(email.send_datetime)} | Sent:{" "}
                {formatDateTime(email.sent_time)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {columnType === "reply_received" && (
          <button
            onClick={() => onMarkNoReply(item)}
            className="rounded-lg border border-yellow-700 px-3 py-2 text-xs text-yellow-300 hover:bg-yellow-950"
          >
            Undo → No Reply
          </button>
        )}

        {columnType === "no_reply" && (
          <button
            onClick={() => onScheduleFollowup(item)}
            className="rounded-lg border border-orange-700 px-3 py-2 text-xs text-orange-300 hover:bg-orange-950"
          >
            Schedule Follow-up
          </button>
        )}

        {(columnType === "reply_received" ||
          columnType === "followup_scheduled") && (
          <>
            <button
              onClick={() => onPositiveReply(item)}
              className="rounded-lg border border-emerald-700 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-950"
            >
              Positive + Reply
            </button>

            <button
              onClick={() => onRepliedReply(item)}
              className="rounded-lg border border-cyan-700 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-950"
            >
              Replied + Reply
            </button>
          </>
        )}

        {columnType === "no_reply" && (
          <button
            onClick={() => onRepliedReply(item)}
            className="rounded-lg border border-blue-700 px-3 py-2 text-xs text-blue-300 hover:bg-blue-950"
          >
            Custom Reply
          </button>
        )}

        <button
          onClick={() => onRepliedClose(item)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
        >
          Replied + Close
        </button>

        <button
          onClick={() => onRejectedClose(item)}
          className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950"
        >
          Rejected + Close
        </button>

        <button
          onClick={() => onClose(item)}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-900"
        >
          Close
        </button>
      </div>

      <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <summary className="cursor-pointer text-sm text-slate-300">
          Preview original email body
        </summary>

        <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-400">
          {item.email_body}
        </pre>
      </details>
    </article>
  );
}