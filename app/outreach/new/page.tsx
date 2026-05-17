"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";
import { supabase } from "@/lib/supabaseClient";

type Professor = {
  id: string;
  professor_name: string;
  email: string;
  university: string | null;
  category: string | null;
  research_area: string | null;
  website_url: string | null;
  notes: string | null;
  reply_status: string;
};

type SubjectVersion = {
  id: string;
  label: string;
  subject: string;
};

type BodyVersion = {
  id: string;
  label: string;
  email_body: string;
};

type ResumeFile = {
  id: string;
  label: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
};

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function makeShortLabel(value: string, fallback: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return fallback;
  }

  return cleaned.slice(0, 45);
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

function StepCard({
  number,
  title,
  description,
  icon,
  children,
}: {
  number: string;
  title: string;
  description: string;
  icon: "user" | "attachment" | "mail" | "compose" | "clock";
  children: React.ReactNode;
}) {
  return (
    <section className="soft-card bg-white p-6">
      <div className="mb-5 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dbe6ff] text-[#171a21]">
          <OutlineIcon name={icon} />
        </div>

        <div>
          <p className="page-eyebrow">Step {number}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#171a21]">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#657187]">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function PreviewRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-[#171a21]">
        {value && value.trim() ? value : "Not selected"}
      </p>
    </div>
  );
}

export default function NewOutreachPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [subjects, setSubjects] = useState<SubjectVersion[]>([]);
  const [bodies, setBodies] = useState<BodyVersion[]>([]);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [professorMode, setProfessorMode] = useState<"existing" | "new">("new");
  const [selectedProfessorId, setSelectedProfessorId] = useState("");

  const [professorForm, setProfessorForm] = useState({
    professor_name: "",
    email: "",
    university: "",
    category: "",
    research_area: "",
    website_url: "",
    notes: "",
  });

  const [selectedResumeId, setSelectedResumeId] = useState("");

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [newSubjectLabel, setNewSubjectLabel] = useState("");
  const [newSubjectText, setNewSubjectText] = useState("");

  const [selectedBodyId, setSelectedBodyId] = useState("");
  const [newBodyLabel, setNewBodyLabel] = useState("");
  const [newBodyText, setNewBodyText] = useState("");

  const [sendDatetime, setSendDatetime] = useState("");
  const [followupRequired, setFollowupRequired] = useState(false);
  const [followupAfterDays, setFollowupAfterDays] = useState("7");

  const selectedProfessor = useMemo(
    () => professors.find((p) => p.id === selectedProfessorId) ?? null,
    [professors, selectedProfessorId]
  );

  const selectedSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) ?? null,
    [subjects, selectedSubjectId]
  );

  const selectedBody = useMemo(
    () => bodies.find((b) => b.id === selectedBodyId) ?? null,
    [bodies, selectedBodyId]
  );

  const selectedResume = useMemo(
    () => resumes.find((r) => r.id === selectedResumeId) ?? null,
    [resumes, selectedResumeId]
  );

  const previewProfessorName =
    professorMode === "existing"
      ? selectedProfessor?.professor_name
      : professorForm.professor_name;

  const previewProfessorEmail =
    professorMode === "existing" ? selectedProfessor?.email : professorForm.email;

  const previewSubject =
    selectedSubjectId === "__new__" ? newSubjectText : selectedSubject?.subject;

  const previewBody =
    selectedBodyId === "__new__" ? newBodyText : selectedBody?.email_body;

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

      await Promise.all([
        loadProfessors(currentUserId),
        loadSubjects(currentUserId),
        loadBodies(currentUserId),
        loadResumes(currentUserId),
      ]);

      setLoading(false);
    }

    initialize();
  }, [router]);

  async function loadProfessors(currentUserId: string) {
    const { data, error } = await supabase
      .from("professors")
      .select("*")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading professors: " + error.message);
      return;
    }

    setProfessors((data ?? []) as Professor[]);
  }

  async function loadSubjects(currentUserId: string) {
    const { data, error } = await supabase
      .from("email_subject_versions")
      .select("id,label,subject")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading subject versions: " + error.message);
      return;
    }

    setSubjects((data ?? []) as SubjectVersion[]);
  }

  async function loadBodies(currentUserId: string) {
    const { data, error } = await supabase
      .from("email_body_versions")
      .select("id,label,email_body")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading email body versions: " + error.message);
      return;
    }

    setBodies((data ?? []) as BodyVersion[]);
  }

  async function loadResumes(currentUserId: string) {
    const { data, error } = await supabase
      .from("resume_files")
      .select("id,label,file_name,file_path,file_type,file_size")
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading resumes: " + error.message);
      return;
    }

    setResumes((data ?? []) as ResumeFile[]);
  }

  function updateProfessorForm(field: string, value: string) {
    setProfessorForm((prev) => ({
      ...prev,
      [field]: value,
    }));
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

  function resetFormAfterSuccess() {
    setProfessorMode("new");

    setProfessorForm({
      professor_name: "",
      email: "",
      university: "",
      category: "",
      research_area: "",
      website_url: "",
      notes: "",
    });

    setSelectedProfessorId("");
    setSelectedSubjectId("");
    setSelectedBodyId("");
    setSelectedResumeId("");
    setNewSubjectLabel("");
    setNewSubjectText("");
    setNewBodyLabel("");
    setNewBodyText("");
    setSendDatetime("");
    setFollowupRequired(false);
    setFollowupAfterDays("7");
  }

  async function getFinalSubject() {
    if (selectedSubjectId !== "__new__") {
      return selectedSubject?.subject ?? "";
    }

    const cleanSubjectText = newSubjectText.trim();

    if (!cleanSubjectText) {
      throw new Error("New subject text is required.");
    }

    const cleanSubjectLabel =
      newSubjectLabel.trim() || makeShortLabel(cleanSubjectText, "Subject");

    const existingSubject = subjects.find((item) => {
      return (
        normalizeText(item.label) === normalizeText(cleanSubjectLabel) &&
        normalizeText(item.subject) === normalizeText(cleanSubjectText)
      );
    });

    if (existingSubject) {
      return existingSubject.subject;
    }

    const sameSubjectDifferentLabel = subjects.find((item) => {
      return normalizeText(item.subject) === normalizeText(cleanSubjectText);
    });

    if (sameSubjectDifferentLabel) {
      return sameSubjectDifferentLabel.subject;
    }

    const { data: subjectData, error: subjectError } = await supabase
      .from("email_subject_versions")
      .insert({
        user_id: userId,
        label: cleanSubjectLabel,
        subject: cleanSubjectText,
      })
      .select("id,label,subject")
      .single();

    if (subjectError) {
      if (subjectError.code === "23505") {
        return cleanSubjectText;
      }

      throw new Error("Subject version insert failed: " + subjectError.message);
    }

    return subjectData.subject;
  }

  async function getFinalBody() {
    if (selectedBodyId !== "__new__") {
      return selectedBody?.email_body ?? "";
    }

    const cleanBodyText = newBodyText.trim();

    if (!cleanBodyText) {
      throw new Error("New email body is required.");
    }

    const cleanBodyLabel =
      newBodyLabel.trim() || makeShortLabel(cleanBodyText, "Email body");

    const existingBody = bodies.find((item) => {
      return (
        normalizeText(item.label) === normalizeText(cleanBodyLabel) &&
        normalizeText(item.email_body) === normalizeText(cleanBodyText)
      );
    });

    if (existingBody) {
      return existingBody.email_body;
    }

    const sameBodyDifferentLabel = bodies.find((item) => {
      return normalizeText(item.email_body) === normalizeText(cleanBodyText);
    });

    if (sameBodyDifferentLabel) {
      return sameBodyDifferentLabel.email_body;
    }

    const { data: bodyData, error: bodyError } = await supabase
      .from("email_body_versions")
      .insert({
        user_id: userId,
        label: cleanBodyLabel,
        email_body: cleanBodyText,
      })
      .select("id,label,email_body")
      .single();

    if (bodyError) {
      if (bodyError.code === "23505") {
        return cleanBodyText;
      }

      throw new Error("Email body version insert failed: " + bodyError.message);
    }

    return bodyData.email_body;
  }

  async function handleSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) {
      setMessage("You are not logged in.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      let professorId = selectedProfessorId;

      if (professorMode === "new") {
        if (!professorForm.professor_name.trim()) {
          throw new Error("Professor / contact name is required.");
        }

        if (!professorForm.email.trim()) {
          throw new Error("Email address is required.");
        }

        const { data: professorData, error: professorError } = await supabase
          .from("professors")
          .insert({
            user_id: userId,
            professor_name: professorForm.professor_name.trim(),
            email: professorForm.email.trim(),
            university: professorForm.university.trim() || null,
            category: professorForm.category.trim() || null,
            research_area: professorForm.research_area.trim() || null,
            website_url: professorForm.website_url.trim() || null,
            notes: professorForm.notes.trim() || null,
            reply_status: "No Reply",
          })
          .select("id")
          .single();

        if (professorError) {
          throw new Error("Professor insert failed: " + professorError.message);
        }

        professorId = professorData.id;
      }

      if (!professorId) {
        throw new Error("Please select or add a recipient.");
      }

      const finalSubject = await getFinalSubject();

      if (!finalSubject.trim()) {
        throw new Error("Please select or add an email subject.");
      }

      const finalBody = await getFinalBody();

      if (!finalBody.trim()) {
        throw new Error("Please select or add an email body.");
      }

      if (!sendDatetime) {
        alert("Please choose a scheduled date and time before submitting.");
        throw new Error("Please choose scheduled date and time.");
      }

      const scheduledDate = new Date(sendDatetime);

      if (isNaN(scheduledDate.getTime())) {
        alert("Invalid scheduled date/time. Please choose a valid date and time.");
        throw new Error("Invalid scheduled date/time.");
      }

      const minimumSafeTime = getMinimumSafeDate();

      if (scheduledDate < minimumSafeTime) {
        const warningMessage =
          "Invalid scheduled time.\n\n" +
          "MailMotive checks new scheduled emails every 30 minutes.\n" +
          "Please choose a send time at least 35 minutes from now.\n\n" +
          `Earliest safe time: ${minimumSafeTime.toLocaleString()}`;

        alert(warningMessage);

        throw new Error(
          `Invalid scheduled time. Earliest safe time: ${minimumSafeTime.toLocaleString()}`
        );
      }

      const safeFollowupDays = Math.max(1, Number(followupAfterDays || "7"));

      const { data: emailData, error: emailError } = await supabase
        .from("email_messages")
        .insert({
          user_id: userId,
          professor_id: professorId,
          subject: finalSubject.trim(),
          email_body: finalBody.trim(),
          send_datetime: scheduledDate.toISOString(),
          status: "Scheduled",
          followup_required: followupRequired,
          followup_after_days: safeFollowupDays,
          email_kind: "initial",
        })
        .select("id")
        .single();

      if (emailError) {
        throw new Error("Email insert failed: " + emailError.message);
      }

      if (!emailData?.id) {
        throw new Error("Email insert failed: no email ID returned.");
      }

      if (selectedResume) {
        const { error: attachmentError } = await supabase
          .from("attachments")
          .insert({
            user_id: userId,
            email_message_id: emailData.id,
            file_name: selectedResume.file_name,
            file_path: selectedResume.file_path,
            file_type: selectedResume.file_type,
            file_size: selectedResume.file_size,
          });

        if (attachmentError) {
          throw new Error("Attachment insert failed: " + attachmentError.message);
        }
      }

      const { error: eventError } = await supabase.from("email_events").insert({
        user_id: userId,
        email_message_id: emailData.id,
        event_type: "Scheduled",
        event_note: "Email scheduled from MailMotive outreach composer.",
      });

      if (eventError) {
        throw new Error(
          "Email was created, but event logging failed: " + eventError.message
        );
      }

      setMessage(
        "Outreach scheduled successfully. Apps Script will register the Gmail trigger within 30 minutes."
      );

      resetFormAfterSuccess();

      await Promise.all([
        loadProfessors(userId),
        loadSubjects(userId),
        loadBodies(userId),
        loadResumes(userId),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong.";

      setMessage(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell activePage="outreach" email={userEmail}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="soft-card bg-white p-8 text-center">
            <div className="icon-box mx-auto h-12 w-12 bg-[#dbe6ff]">
              <OutlineIcon name="compose" />
            </div>
            <p className="page-eyebrow mt-4">New outreach</p>
            <h1 className="mt-2 text-2xl font-semibold text-black">
              Loading composer
            </h1>
            <p className="mt-3 text-sm text-[#657187]">
              Preparing contacts, files, subjects, and email bodies.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="outreach" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Create scheduled email</p>
          <h1 className="page-title mt-2">New Outreach</h1>
          <p className="page-description">
            Create a professor, recruiter, HR, or lab outreach email in one
            guided flow. Choose a recipient, attachment, subject, body, schedule
            time, and optional follow-up reminder.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/emails" className="btn btn-light">
            <OutlineIcon name="mail" className="mr-2 h-4 w-4" />
            Email tracker
          </Link>

          <Link href="/resumes" className="btn btn-light">
            <OutlineIcon name="file" className="mr-2 h-4 w-4" />
            Files
          </Link>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <span className="status-pill bg-[#dbe6ff]">Step-by-step composer</span>
        <span className="status-pill bg-[#dcf5e7]">Gmail send automation</span>
        <span className="status-pill bg-[#f4dceb]">Reusable templates</span>
        <span className="status-pill bg-white/80">35 min safety buffer</span>
      </div>

      {message ? (
        <div
          className={`mt-6 rounded-[22px] border p-4 ${
            message.toLowerCase().includes("successfully")
              ? "border-green-200 bg-[#dcf5e7]"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-sm font-semibold text-[#171a21]">{message}</p>
        </div>
      ) : null}

      <form onSubmit={handleSchedule} className="mt-8">
        <div className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="space-y-5">
            <StepCard
              number="1"
              title="Recipient"
              description="Select an existing contact or add a new professor, recruiter, HR contact, or lab target."
              icon="user"
            >
              <div className="mb-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setProfessorMode("new")}
                  className={`rounded-[20px] border p-4 text-left transition ${
                    professorMode === "new"
                      ? "border-black/20 bg-[#dbe6ff]"
                      : "border-black/8 bg-white hover:bg-[#f6f8fc]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#171a21]">
                    Add new contact
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#657187]">
                    Save a new professor, recruiter, HR, or lab contact.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setProfessorMode("existing")}
                  className={`rounded-[20px] border p-4 text-left transition ${
                    professorMode === "existing"
                      ? "border-black/20 bg-[#dcf5e7]"
                      : "border-black/8 bg-white hover:bg-[#f6f8fc]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#171a21]">
                    Select existing
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#657187]">
                    Use a saved contact from your database.
                  </p>
                </button>
              </div>

              {professorMode === "existing" ? (
                <div>
                  <FieldLabel title="Saved contact" required />

                  <select
                    value={selectedProfessorId}
                    onChange={(e) => setSelectedProfessorId(e.target.value)}
                    className="select"
                  >
                    <option value="">Choose contact...</option>
                    {professors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.professor_name} - {professor.email}
                      </option>
                    ))}
                  </select>

                  {selectedProfessor ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <PreviewRow
                        label="University"
                        value={selectedProfessor.university}
                      />
                      <PreviewRow
                        label="Category"
                        value={selectedProfessor.category}
                      />
                      <PreviewRow
                        label="Research / Area"
                        value={selectedProfessor.research_area}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel title="Name" required />
                    <input
                      required
                      value={professorForm.professor_name}
                      onChange={(e) =>
                        updateProfessorForm("professor_name", e.target.value)
                      }
                      className="input"
                      placeholder="e.g. Prof. Dr. Anna Weber"
                    />
                  </div>

                  <div>
                    <FieldLabel title="Email" required />
                    <input
                      required
                      type="email"
                      value={professorForm.email}
                      onChange={(e) =>
                        updateProfessorForm("email", e.target.value)
                      }
                      className="input"
                      placeholder="name@university.de"
                    />
                  </div>

                  <div>
                    <FieldLabel title="University / Company" />
                    <input
                      value={professorForm.university}
                      onChange={(e) =>
                        updateProfessorForm("university", e.target.value)
                      }
                      className="input"
                      placeholder="TU Munich, FAU, Siemens..."
                    />
                  </div>

                  <div>
                    <FieldLabel title="Category" />
                    <input
                      value={professorForm.category}
                      onChange={(e) =>
                        updateProfessorForm("category", e.target.value)
                      }
                      className="input"
                      placeholder="Professor, HR, Recruiter, Lab..."
                    />
                  </div>

                  <div>
                    <FieldLabel title="Research area / Role area" />
                    <input
                      value={professorForm.research_area}
                      onChange={(e) =>
                        updateProfessorForm("research_area", e.target.value)
                      }
                      className="input"
                      placeholder="AI, HCI, Data Analytics..."
                    />
                  </div>

                  <div>
                    <FieldLabel title="Website URL" />
                    <input
                      value={professorForm.website_url}
                      onChange={(e) =>
                        updateProfessorForm("website_url", e.target.value)
                      }
                      className="input"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <FieldLabel title="Notes" />
                    <textarea
                      value={professorForm.notes}
                      onChange={(e) =>
                        updateProfessorForm("notes", e.target.value)
                      }
                      className="textarea min-h-24"
                      placeholder="Why this person is relevant, what to mention, possible personalization..."
                    />
                  </div>
                </div>
              )}
            </StepCard>

            <StepCard
              number="2"
              title="Attachment"
              description="Attach a saved CV, resume, or supporting file. You can also schedule without an attachment."
              icon="attachment"
            >
              <FieldLabel title="Attachment file" />

              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="select"
              >
                <option value="">No attachment selected</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.label} - {resume.file_name}
                  </option>
                ))}
              </select>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="help-text">
                  File must already be uploaded in the Files page.
                </p>

                <Link
                  href="/resumes"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#171a21]"
                >
                  Upload file
                  <OutlineIcon name="arrowRight" className="h-4 w-4" />
                </Link>
              </div>
            </StepCard>

            <StepCard
              number="3"
              title="Subject"
              description="Use a saved subject version or create a new reusable subject for future outreach."
              icon="mail"
            >
              <FieldLabel title="Subject version" required />

              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="select"
              >
                <option value="">Choose saved subject...</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.label} - {subject.subject}
                  </option>
                ))}
                <option value="__new__">+ Add new subject version</option>
              </select>

              {selectedSubjectId === "__new__" ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <FieldLabel title="Subject label" />
                    <input
                      value={newSubjectLabel}
                      onChange={(e) => setNewSubjectLabel(e.target.value)}
                      className="input"
                      placeholder="e.g. HiWi Application"
                    />
                  </div>

                  <div>
                    <FieldLabel title="Actual subject" required />
                    <input
                      value={newSubjectText}
                      onChange={(e) => setNewSubjectText(e.target.value)}
                      className="input"
                      placeholder="Application for HiWi position..."
                    />
                  </div>
                </div>
              ) : null}

              {selectedSubject ? (
                <div className="mt-4 rounded-2xl bg-[#dbe6ff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                    Selected subject
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#171a21]">
                    {selectedSubject.subject}
                  </p>
                </div>
              ) : null}
            </StepCard>

            <StepCard
              number="4"
              title="Email body"
              description="Choose a saved email body or create a new one. Keep it reusable but personalize where needed."
              icon="compose"
            >
              <FieldLabel title="Email body version" required />

              <select
                value={selectedBodyId}
                onChange={(e) => setSelectedBodyId(e.target.value)}
                className="select"
              >
                <option value="">Choose saved email body...</option>
                {bodies.map((body) => (
                  <option key={body.id} value={body.id}>
                    {body.label}
                  </option>
                ))}
                <option value="__new__">+ Add new email body version</option>
              </select>

              {selectedBodyId === "__new__" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <FieldLabel title="Body label" />
                    <input
                      value={newBodyLabel}
                      onChange={(e) => setNewBodyLabel(e.target.value)}
                      className="input"
                      placeholder="e.g. AI professor cold email"
                    />
                  </div>

                  <div>
                    <FieldLabel title="Email body" required />
                    <textarea
                      value={newBodyText}
                      onChange={(e) => setNewBodyText(e.target.value)}
                      className="textarea min-h-64"
                      placeholder="Dear Professor..."
                    />
                  </div>
                </div>
              ) : null}

              {selectedBody ? (
                <div className="mt-4 rounded-2xl bg-[#f6f8fc] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                    Selected body
                  </p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-[#171a21]">
                    {selectedBody.email_body}
                  </pre>
                </div>
              ) : null}
            </StepCard>

            <StepCard
              number="5"
              title="Schedule"
              description="Choose when the email should be sent. Keep at least 35 minutes buffer for trigger registration."
              icon="clock"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel title="Send date and time" required />
                  <input
                    required
                    type="datetime-local"
                    min={getMinimumDatetimeLocal()}
                    value={sendDatetime}
                    onChange={(e) => setSendDatetime(e.target.value)}
                    className="input"
                  />
                  <p className="help-text">
                    Choose at least 35 minutes from now because the registration
                    trigger runs every 30 minutes.
                  </p>
                </div>

                <div>
                  <FieldLabel title="Follow-up after days" />
                  <input
                    type="number"
                    min="1"
                    value={followupAfterDays}
                    onChange={(e) => setFollowupAfterDays(e.target.value)}
                    className="input"
                  />

                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-black/8 bg-[#f6f8fc] p-4 text-sm font-medium text-[#171a21]">
                    <input
                      type="checkbox"
                      checked={followupRequired}
                      onChange={(e) => setFollowupRequired(e.target.checked)}
                    />
                    Follow-up reminder required
                  </label>
                </div>
              </div>
            </StepCard>
          </div>

          <aside className="space-y-5">
            <div className="soft-card sticky top-0 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="page-eyebrow">Live review</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                    Email summary
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#657187]">
                    Confirm the important details before creating the scheduled
                    email.
                  </p>
                </div>

                <div className="icon-box h-12 w-12 bg-[#e5ebff]">
                  <OutlineIcon name="mail" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <PreviewRow label="Recipient" value={previewProfessorName} />
                <PreviewRow label="Recipient email" value={previewProfessorEmail} />
                <PreviewRow label="Attachment" value={selectedResume?.file_name} />
                <PreviewRow label="Subject" value={previewSubject} />

                <div className="rounded-2xl border border-black/8 bg-white/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                    Body preview
                  </p>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm leading-6 text-[#171a21]">
                    {previewBody && previewBody.trim()
                      ? previewBody
                      : "Not selected"}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] bg-[#eef4ff] p-4">
                <div className="flex items-center gap-3">
                  <div className="icon-box h-10 w-10 bg-white/85">
                    <OutlineIcon name="clock" className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[#171a21]">
                      Schedule rule
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#657187]">
                      Minimum safe time is 35 minutes from now.
                    </p>
                  </div>
                </div>
              </div>

              <button
                disabled={saving}
                className="btn btn-dark mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                {saving ? "Scheduling..." : "Schedule Outreach Email"}
              </button>
            </div>

            <div className="soft-card bg-[#dcf5e7] p-5">
              <div className="flex items-start gap-3">
                <div className="icon-box h-10 w-10 bg-white/85">
                  <OutlineIcon name="check" className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#171a21]">
                    What happens after saving?
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#657187]">
                    MailMotive saves the email as Scheduled. Apps Script checks
                    Supabase, creates a one-time Gmail trigger, sends the email,
                    and updates the status.
                  </p>
                </div>
              </div>
            </div>

            <div className="soft-card bg-[#f4dceb] p-5">
              <div className="flex items-start gap-3">
                <div className="icon-box h-10 w-10 bg-white/85">
                  <OutlineIcon name="repeat" className="h-4 w-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#171a21]">
                    Follow-up reminder
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#657187]">
                    Follow-up required means the reminder is active. It does not
                    create a follow-up email until you schedule one later.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </AppShell>
  );
}