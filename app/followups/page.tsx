"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";
import { supabase } from "@/lib/supabaseClient";

type OutlineIconName = ComponentProps<typeof OutlineIcon>["name"];

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

const SEND_WINDOW_START_HOUR = 9;
const SEND_WINDOW_END_HOUR = 15;
const MINIMUM_BUFFER_MINUTES = 20;

function getSendingWindowText() {
  return "09:00 to 14:45";
}

function getMinimumSafeDate() {
  const now = new Date();
  return new Date(now.getTime() + MINIMUM_BUFFER_MINUTES * 60 * 1000);
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

function isInsideSendingWindow(date: Date) {
  const hour = date.getHours();
  const minutes = date.getMinutes();

  const selectedMinutes = hour * 60 + minutes;
  const startMinutes = SEND_WINDOW_START_HOUR * 60;
  const endMinutes = SEND_WINDOW_END_HOUR * 60;

  return selectedMinutes >= startMinutes && selectedMinutes < endMinutes;
}

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

function getStatusClass(status: string) {
  if (status === "Due") return "bg-[#fff2d8] text-[#171a21]";
  if (status === "Upcoming") return "bg-[#dbe6ff] text-[#171a21]";
  if (status === "Positive") return "bg-[#dcf5e7] text-[#171a21]";
  if (status === "Replied") return "bg-[#dbe6ff] text-[#171a21]";
  if (status === "Rejected") return "bg-red-50 text-red-700";
  if (status === "Closed") return "bg-[#eee8df] text-[#171a21]";
  if (status === "Sent") return "bg-[#dcf5e7] text-[#171a21]";
  if (status === "Scheduled") return "bg-[#dbe6ff] text-[#171a21]";
  if (status === "Trigger Created") return "bg-[#f4dceb] text-[#171a21]";
  if (status === "Sending") return "bg-[#fff2d8] text-[#171a21]";
  if (status === "Failed") return "bg-red-50 text-red-700";
  if (status === "Quota Blocked") return "bg-red-50 text-red-700";

  return "bg-white text-[#657187]";
}

function getStatusIcon(status: string): OutlineIconName {
  if (status === "Due") return "warning";
  if (status === "Upcoming") return "clock";
  if (status === "Positive") return "check";
  if (status === "Replied") return "mail";
  if (status === "Rejected") return "x";
  if (status === "Closed") return "check";
  if (status === "Scheduled") return "calendar";
  if (status === "Trigger Created") return "gear";
  if (status === "Sending") return "clock";
  if (status === "Sent") return "check";
  if (status === "Failed") return "warning";
  if (status === "Quota Blocked") return "warning";

  return "repeat";
}

function FieldLabel({
  title,
  required,
}: {
  title: string;
  required?: boolean;
}) {
  return (
    <label className="label">
      {title}
      {required ? <span className="ml-1 text-red-500">*</span> : null}
    </label>
  );
}

function StatBox({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: "repeat" | "calendar" | "mail" | "warning" | "check";
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

function MiniEmailCard({
  email,
  label,
}: {
  email: ChildEmail;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
            email.status
          )}`}
        >
          <OutlineIcon name={getStatusIcon(email.status)} className="h-3 w-3" />
          {email.status === "Trigger Created" ? "Scheduled" : email.status}
        </span>

        <span className="rounded-full bg-[#f6f8fc] px-2.5 py-1 text-xs font-medium text-[#657187]">
          {label}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-sm font-semibold text-[#171a21]">
        {email.subject}
      </p>

      <p className="mt-1 text-xs text-[#657187]">
        Send time: {formatDateTime(email.send_datetime)}
      </p>
    </div>
  );
}

function FollowupCard({
  item,
  type,
  onScheduleFollowup,
  onPositiveReply,
  onRepliedReply,
  onRejected,
  onClose,
  onUndoNoReply,
}: {
  item: BoardItem;
  type: "no_reply" | "scheduled" | "reply";
  onScheduleFollowup: (item: BoardItem) => void;
  onPositiveReply: (item: BoardItem) => void;
  onRepliedReply: (item: BoardItem) => void;
  onRejected: (item: BoardItem) => void;
  onClose: (item: BoardItem) => void;
  onUndoNoReply: (item: BoardItem) => void;
}) {
  const reminderStatus = getReminderStatus(item);
  const dueDate = getFollowupDueDate(item);
  const replyStatus = getReplyStatus(item);

  return (
    <article className="rounded-[26px] border border-black/8 bg-[#f9fbff] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {type === "no_reply" ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                  reminderStatus
                )}`}
              >
                <OutlineIcon
                  name={getStatusIcon(reminderStatus)}
                  className="h-3.5 w-3.5"
                />
                {reminderStatus}
              </span>
            ) : null}

            {type === "scheduled" ? (
              <span className="rounded-full bg-[#f4dceb] px-3 py-1 text-xs font-semibold text-[#171a21]">
                Follow-up scheduled
              </span>
            ) : null}

            {type === "reply" ? (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                  replyStatus
                )}`}
              >
                <OutlineIcon
                  name={getStatusIcon(replyStatus)}
                  className="h-3.5 w-3.5"
                />
                {replyStatus}
              </span>
            ) : null}

            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#657187]">
              Follow-up after {item.followup_after_days} days
            </span>

            {item.professors?.category ? (
              <span className="rounded-full bg-[#dbe6ff] px-3 py-1 text-xs font-medium text-[#171a21]">
                {item.professors.category}
              </span>
            ) : null}
          </div>

          <h3 className="mt-4 break-words text-lg font-semibold leading-7 text-[#171a21]">
            {item.subject}
          </h3>

          <p className="mt-1 text-sm leading-6 text-[#657187]">
            {item.professors?.professor_name || "Unknown contact"} ·{" "}
            {item.professors?.email || "No email"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {item.professors?.university ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#657187]">
                {item.professors.university}
              </span>
            ) : null}

            {item.professors?.research_area ? (
              <span className="rounded-full bg-[#dcf5e7] px-3 py-1 text-xs font-medium text-[#171a21]">
                {item.professors.research_area}
              </span>
            ) : null}

            <span className="rounded-full bg-[#f6f8fc] px-3 py-1 text-xs font-medium text-[#657187]">
              Original sent: {formatDateTime(item.sent_time)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-black/8 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                Follow-up due
              </p>
              <p className="mt-1 text-sm text-[#171a21]">
                {dueDate ? formatDateTime(dueDate.toISOString()) : "No sent time"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/8 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                Original status
              </p>
              <p className="mt-1 text-sm text-[#171a21]">{item.status}</p>
            </div>
          </div>
        </div>

        <div className="w-full space-y-2 sm:w-52">
          {type === "no_reply" ? (
            <button
              onClick={() => onScheduleFollowup(item)}
              className="w-full rounded-2xl border border-black/8 bg-[#dbe6ff] px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#cbd9ff]"
              type="button"
            >
              Schedule Follow-up
            </button>
          ) : null}

          {type !== "reply" ? (
            <>
              <button
                onClick={() => onPositiveReply(item)}
                className="w-full rounded-2xl border border-black/8 bg-[#dcf5e7] px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#c9f1d9]"
                type="button"
              >
                Positive + Reply
              </button>

              <button
                onClick={() => onRepliedReply(item)}
                className="w-full rounded-2xl border border-black/8 bg-white px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#f6f8fc]"
                type="button"
              >
                Replied + Reply
              </button>

              <button
                onClick={() => onRejected(item)}
                className="w-full rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                type="button"
              >
                Rejected / Close
              </button>
            </>
          ) : null}

          {type === "reply" ? (
            <>
              <button
                onClick={() => onUndoNoReply(item)}
                className="w-full rounded-2xl border border-black/8 bg-[#eee8df] px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#e2dacd]"
                type="button"
              >
                Undo → No Reply
              </button>

              <button
                onClick={() => onClose(item)}
                className="w-full rounded-2xl border border-black/8 bg-white px-3 py-2 text-xs font-semibold text-[#171a21] transition hover:bg-[#f6f8fc]"
                type="button"
              >
                Mark Closed
              </button>
            </>
          ) : null}
        </div>
      </div>

      {item.followupEmails.length > 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
            Linked follow-up emails
          </p>

          {item.followupEmails.map((email) => (
            <MiniEmailCard key={email.id} email={email} label="Follow-up" />
          ))}
        </div>
      ) : null}

      {item.customReplyEmails.length > 0 ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
            Linked custom replies
          </p>

          {item.customReplyEmails.map((email) => (
            <MiniEmailCard key={email.id} email={email} label="Custom reply" />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function FollowupsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

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

  const totalDue = noReplyYetItems.filter(
    (item) => getReminderStatus(item) === "Due"
  ).length;

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
      setUserEmail(data.session.user.email ?? null);

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

  async function handleScheduleComposer(e: FormEvent<HTMLFormElement>) {
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
        "MailMotive checks due emails every 15 minutes.\n" +
        `Please choose a send time at least ${MINIMUM_BUFFER_MINUTES} minutes from now.\n\n` +
        `Earliest safe time: ${minimumSafeTime.toLocaleString()}`;

      alert(warningMessage);
      setMessage(
        `Invalid scheduled time. Earliest safe time: ${minimumSafeTime.toLocaleString()}`
      );
      return;
    }

    if (!isInsideSendingWindow(scheduledDate)) {
      const warningMessage =
        "Invalid scheduled time.\n\n" +
        "MailMotive only sends emails between 9:00 AM and 3:00 PM.\n" +
        `Please choose a time from ${getSendingWindowText()}.\n\n` +
        "The last safe time is 14:45 because 15:00 is outside the sending window.";

      alert(warningMessage);
      setMessage(
        "Invalid scheduled time. Please choose a time between 9:00 AM and 2:45 PM."
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
        "Created from follow-up workflow. It will be picked by the recurring 15-minute scheduler."
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
          ? "Follow-up email scheduled successfully. MailMotive will send it between 9:00 AM and 3:00 PM when the scheduled time arrives."
          : "Custom reply scheduled successfully. MailMotive will send it between 9:00 AM and 3:00 PM when the scheduled time arrives."
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

  if (loading) {
    return (
      <AppShell activePage="followups" email={userEmail}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="soft-card bg-white p-8 text-center">
            <div className="icon-box mx-auto h-12 w-12 bg-[#f4dceb]">
              <OutlineIcon name="repeat" />
            </div>

            <p className="page-eyebrow mt-4">Follow-ups</p>

            <h1 className="mt-2 text-2xl font-semibold text-black">
              Loading workflow board
            </h1>

            <p className="mt-3 text-sm text-[#657187]">
              Preparing no-reply, scheduled follow-up, and reply status records.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="followups" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Follow-up workflow</p>

          <h1 className="page-title mt-2">Follow-ups</h1>

          <p className="page-description">
            Manage no-reply outreach, scheduled follow-ups, positive replies,
            rejected responses, and custom replies from one workflow board.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (userId) {
                loadBoardItems(userId);
                loadFollowupTemplates(userId);
              }
            }}
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
        <span className="status-pill bg-[#fff2d8]">{totalDue} due</span>
        <span className="status-pill bg-[#dbe6ff]">
          {noReplyYetItems.length} no reply
        </span>
        <span className="status-pill bg-[#f4dceb]">
          {followupScheduledItems.length} scheduled
        </span>
        <span className="status-pill bg-[#dcf5e7]">
          {replyReceivedItems.length} replied
        </span>
        <span className="status-pill bg-white/80">20 min safety buffer</span>
        <span className="status-pill bg-white/80">9 AM - 3 PM window</span>
      </div>

      {message ? (
        <div
          className={`mt-6 rounded-[22px] border p-4 ${
            message.toLowerCase().includes("successfully") ||
            message.toLowerCase().includes("marked") ||
            message.toLowerCase().includes("moved")
              ? "border-green-200 bg-[#dcf5e7]"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-sm font-semibold text-[#171a21]">{message}</p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-5">
          <div className="soft-card bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Board overview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Reply health
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Reminder active means the original email needs tracking. It
                  does not mean a follow-up email already exists.
                </p>
              </div>

              <div className="icon-box h-12 w-12 bg-[#f4dceb]">
                <OutlineIcon name="repeat" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatBox
                label="Due"
                value={totalDue}
                icon="warning"
                className="bg-[#fff2d8]"
              />

              <StatBox
                label="No Reply"
                value={noReplyYetItems.length}
                icon="mail"
                className="bg-[#dbe6ff]"
              />

              <StatBox
                label="Scheduled"
                value={followupScheduledItems.length}
                icon="calendar"
                className="bg-[#f4dceb]"
              />

              <StatBox
                label="Replies"
                value={replyReceivedItems.length}
                icon="check"
                className="bg-[#dcf5e7]"
              />
            </div>
          </div>

          <div className="soft-card bg-[rgba(243,248,255,0.76)] p-6">
            <p className="page-eyebrow">Search</p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
              Find record
            </h2>

            <div className="mt-5">
              <FieldLabel title="Search follow-ups" />

              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input"
                placeholder="Search name, email, university, category, subject..."
              />
            </div>

            <button
              onClick={() => setSearchText("")}
              className="btn btn-light mt-4 w-full"
              type="button"
            >
              Clear search
            </button>
          </div>

          <div className="soft-card bg-[#dcf5e7] p-5">
            <div className="flex items-start gap-3">
              <div className="icon-box h-10 w-10 bg-white/85">
                <OutlineIcon name="check" className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#171a21]">
                  Correct logic
                </p>

                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Follow-up required means reminder active. A follow-up is only
                  scheduled when a linked email exists with email_kind =
                  followup. MailMotive now uses one recurring 15-minute
                  scheduler, not one trigger per email.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          {activeEmail && composerMode ? (
            <form
              onSubmit={handleScheduleComposer}
              className="soft-card bg-white p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="page-eyebrow">
                    {composerMode === "followup"
                      ? "Schedule follow-up"
                      : "Schedule custom reply"}
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                    {activeEmail.professors?.professor_name || "Selected contact"}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-[#657187]">
                    Original subject: {activeEmail.subject}
                  </p>
                </div>

                <button
                  onClick={closeComposer}
                  className="btn btn-light"
                  type="button"
                >
                  Close composer
                </button>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {composerMode === "followup" ? (
                  <div className="md:col-span-2">
                    <FieldLabel title="Template" />

                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="select"
                    >
                      <option value="">No template / write manually</option>

                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.label}
                        </option>
                      ))}

                      <option value="__new__">+ Save as new template</option>
                    </select>
                  </div>
                ) : null}

                {composerMode === "followup" &&
                selectedTemplateId === "__new__" ? (
                  <div className="md:col-span-2">
                    <FieldLabel title="New template label" />

                    <input
                      value={newTemplateLabel}
                      onChange={(e) => setNewTemplateLabel(e.target.value)}
                      className="input"
                      placeholder="e.g. Polite follow-up after 7 days"
                    />
                  </div>
                ) : null}

                <div>
                  <FieldLabel title="Subject" required />

                  <input
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    className="input"
                    placeholder="Follow-up: ..."
                  />
                </div>

                <div>
                  <FieldLabel title="Send date and time" required />

                  <input
                    type="datetime-local"
                    min={getMinimumDatetimeLocal()}
                    value={replySendDatetime}
                    onChange={(e) => setReplySendDatetime(e.target.value)}
                    className="input"
                  />

                  <p className="help-text">
                    Choose a time from {getSendingWindowText()}, at least{" "}
                    {MINIMUM_BUFFER_MINUTES} minutes from now. MailMotive checks
                    due emails every 15 minutes.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <FieldLabel title="Email body" required />

                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    className="textarea min-h-56"
                    placeholder="Dear Professor..."
                  />
                </div>
              </div>

              <button
                disabled={savingComposer}
                className="btn btn-dark mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                {savingComposer
                  ? "Scheduling..."
                  : composerMode === "followup"
                    ? "Schedule Follow-up Email"
                    : "Schedule Custom Reply"}
              </button>
            </form>
          ) : null}

          <div className="soft-card bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="page-eyebrow">No reply yet</p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Reminder active, no follow-up scheduled
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  These contacts have not replied and do not yet have a linked
                  follow-up email.
                </p>
              </div>

              <span className="rounded-full bg-[#dbe6ff] px-3 py-1 text-sm font-semibold text-[#171a21]">
                {noReplyYetItems.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {noReplyYetItems.length === 0 ? (
                <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-6 text-center">
                  <p className="text-sm font-semibold text-[#171a21]">
                    No no-reply records found
                  </p>

                  <p className="mt-2 text-sm text-[#657187]">
                    All reminder-active emails are either replied or already
                    have follow-ups scheduled.
                  </p>
                </div>
              ) : (
                noReplyYetItems.map((item) => (
                  <FollowupCard
                    key={item.id}
                    item={item}
                    type="no_reply"
                    onScheduleFollowup={openFollowupComposer}
                    onPositiveReply={openPositiveReply}
                    onRepliedReply={openRepliedReply}
                    onRejected={(selected) =>
                      updateOutcome(selected, "Rejected", true)
                    }
                    onClose={(selected) =>
                      updateOutcome(selected, "Closed", true)
                    }
                    onUndoNoReply={markAsNoReply}
                  />
                ))
              )}
            </div>
          </div>

          <div className="soft-card bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="page-eyebrow">Follow-up scheduled</p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Linked follow-up emails exist
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  These original emails already have a linked follow-up email.
                </p>
              </div>

              <span className="rounded-full bg-[#f4dceb] px-3 py-1 text-sm font-semibold text-[#171a21]">
                {followupScheduledItems.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {followupScheduledItems.length === 0 ? (
                <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-6 text-center">
                  <p className="text-sm font-semibold text-[#171a21]">
                    No follow-up emails scheduled
                  </p>

                  <p className="mt-2 text-sm text-[#657187]">
                    Schedule follow-ups from the no-reply section.
                  </p>
                </div>
              ) : (
                followupScheduledItems.map((item) => (
                  <FollowupCard
                    key={item.id}
                    item={item}
                    type="scheduled"
                    onScheduleFollowup={openFollowupComposer}
                    onPositiveReply={openPositiveReply}
                    onRepliedReply={openRepliedReply}
                    onRejected={(selected) =>
                      updateOutcome(selected, "Rejected", true)
                    }
                    onClose={(selected) =>
                      updateOutcome(selected, "Closed", true)
                    }
                    onUndoNoReply={markAsNoReply}
                  />
                ))
              )}
            </div>
          </div>

          <div className="soft-card bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="page-eyebrow">Reply received</p>

                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Replied, positive, rejected, or closed
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  These contacts have been labeled as replied or completed.
                </p>
              </div>

              <span className="rounded-full bg-[#dcf5e7] px-3 py-1 text-sm font-semibold text-[#171a21]">
                {replyReceivedItems.length}
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {replyReceivedItems.length === 0 ? (
                <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-6 text-center">
                  <p className="text-sm font-semibold text-[#171a21]">
                    No replies marked yet
                  </p>

                  <p className="mt-2 text-sm text-[#657187]">
                    Mark replies from the no-reply or scheduled sections.
                  </p>
                </div>
              ) : (
                replyReceivedItems.map((item) => (
                  <FollowupCard
                    key={item.id}
                    item={item}
                    type="reply"
                    onScheduleFollowup={openFollowupComposer}
                    onPositiveReply={openPositiveReply}
                    onRepliedReply={openRepliedReply}
                    onRejected={(selected) =>
                      updateOutcome(selected, "Rejected", true)
                    }
                    onClose={(selected) =>
                      updateOutcome(selected, "Closed", true)
                    }
                    onUndoNoReply={markAsNoReply}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </section>
    </AppShell>
  );
}