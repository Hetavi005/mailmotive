"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

export default function NewOutreachPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

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

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;
      setUserId(currentUserId);

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

    setProfessors(data ?? []);
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

    setSubjects(data ?? []);
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

    setBodies(data ?? []);
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

    setResumes(data ?? []);
  }

  function updateProfessorForm(field: string, value: string) {
    setProfessorForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function getMinimumSafeDate() {
    const now = new Date();
    return new Date(now.getTime() + 5 * 60 * 1000);
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

  async function handleSchedule(e: React.FormEvent<HTMLFormElement>) {
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
          throw new Error("Professor name is required.");
        }

        if (!professorForm.email.trim()) {
          throw new Error("Professor email is required.");
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
        throw new Error("Please select or add a professor.");
      }

      let finalSubject = selectedSubject?.subject ?? "";

      if (selectedSubjectId === "__new__") {
        if (!newSubjectText.trim()) {
          throw new Error("New subject text is required.");
        }

        const subjectLabel =
  newSubjectLabel.trim() || newSubjectText.trim().slice(0, 40);

const existingSubject = subjects.find(
  (item) =>
    item.label.trim().toLowerCase() === subjectLabel.trim().toLowerCase() &&
    item.subject.trim().toLowerCase() === newSubjectText.trim().toLowerCase()
);

if (existingSubject) {
  finalSubject = existingSubject.subject;
} else {
  const { data: subjectData, error: subjectError } = await supabase
    .from("email_subject_versions")
    .insert({
      user_id: userId,
      label: subjectLabel,
      subject: newSubjectText.trim(),
    })
    .select("id,label,subject")
    .single();

  if (subjectError) {
    throw new Error("Subject version insert failed: " + subjectError.message);
  }

  finalSubject = subjectData.subject;
}
      }

      if (!finalSubject.trim()) {
        throw new Error("Please select or add an email subject.");
      }

      let finalBody = selectedBody?.email_body ?? "";

      if (selectedBodyId === "__new__") {
        if (!newBodyText.trim()) {
          throw new Error("New email body is required.");
        }

        const bodyLabel =
  newBodyLabel.trim() ||
  newBodyText.trim().replace(/\s+/g, " ").slice(0, 45) ||
  "Email body";

const existingBody = bodies.find(
  (item) =>
    item.label.trim().toLowerCase() === bodyLabel.trim().toLowerCase() &&
    item.email_body.trim().toLowerCase() === newBodyText.trim().toLowerCase()
);

if (existingBody) {
  finalBody = existingBody.email_body;
} else {
  const { data: bodyData, error: bodyError } = await supabase
    .from("email_body_versions")
    .insert({
      user_id: userId,
      label: bodyLabel,
      email_body: newBodyText.trim(),
    })
    .select("id,label,email_body")
    .single();

  if (bodyError) {
    throw new Error("Email body version insert failed: " + bodyError.message);
  }

  finalBody = bodyData.email_body;
}
      }

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
          `Invalid scheduled time. Please choose a time at least 35 minutes from now. Earliest safe time: ${minimumSafeTime.toLocaleString()}`
        );
      }

      console.log("Creating email with:", {
        user_id: userId,
        professor_id: professorId,
        subject: finalSubject.trim(),
        send_datetime: scheduledDate.toISOString(),
        status: "Scheduled",
      });

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
          followup_after_days: Number(followupAfterDays || "7"),
        })
        .select("id")
        .single();

      console.log("Email insert result:", { emailData, emailError });

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
        event_note: "Email scheduled from MailMotive all-in-one composer.",
      });

      if (eventError) {
        throw new Error(
          "Email was created, but event logging failed: " + eventError.message
        );
      }

      setMessage(
        "Outreach scheduled successfully. Apps Script will register the Gmail send trigger within 30 minutes."
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading outreach composer...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">New Outreach</h1>
            <p className="mt-2 text-slate-400">
              Add/select professor and schedule email in one flow.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
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

        <form onSubmit={handleSchedule} className="mt-8 space-y-8">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">1. Professor</h2>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setProfessorMode("new")}
                className={`rounded-xl px-4 py-2 text-sm ${
                  professorMode === "new"
                    ? "bg-emerald-400 text-slate-950"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                Add new professor
              </button>

              <button
                type="button"
                onClick={() => setProfessorMode("existing")}
                className={`rounded-xl px-4 py-2 text-sm ${
                  professorMode === "existing"
                    ? "bg-emerald-400 text-slate-950"
                    : "border border-slate-700 text-slate-300"
                }`}
              >
                Select existing professor
              </button>
            </div>

            {professorMode === "existing" ? (
              <div className="mt-6">
                <label className="mb-1 block text-sm text-slate-300">
                  Select professor
                </label>

                <select
                  value={selectedProfessorId}
                  onChange={(e) => setSelectedProfessorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                >
                  <option value="">Choose professor...</option>
                  {professors.map((professor) => (
                    <option key={professor.id} value={professor.id}>
                      {professor.professor_name} — {professor.email}
                    </option>
                  ))}
                </select>

                {selectedProfessor && (
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <p>
                      University:{" "}
                      {selectedProfessor.university || "No university"}
                    </p>
                    <p>
                      Category: {selectedProfessor.category || "No category"}
                    </p>
                    <p>
                      Research:{" "}
                      {selectedProfessor.research_area || "No research area"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <input
                  required
                  value={professorForm.professor_name}
                  onChange={(e) =>
                    updateProfessorForm("professor_name", e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Professor name *"
                />

                <input
                  required
                  type="email"
                  value={professorForm.email}
                  onChange={(e) => updateProfessorForm("email", e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Professor email *"
                />

                <input
                  value={professorForm.university}
                  onChange={(e) =>
                    updateProfessorForm("university", e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="University"
                />

                <input
                  value={professorForm.category}
                  onChange={(e) =>
                    updateProfessorForm("category", e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Category"
                />

                <input
                  value={professorForm.research_area}
                  onChange={(e) =>
                    updateProfessorForm("research_area", e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Research area"
                />

                <input
                  value={professorForm.website_url}
                  onChange={(e) =>
                    updateProfessorForm("website_url", e.target.value)
                  }
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Website URL"
                />

                <textarea
                  value={professorForm.notes}
                  onChange={(e) => updateProfessorForm("notes", e.target.value)}
                  className="min-h-24 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400 md:col-span-2"
                  placeholder="Notes"
                />
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">2. Resume / Attachment</h2>

            <select
              value={selectedResumeId}
              onChange={(e) => setSelectedResumeId(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
            >
              <option value="">No attachment selected</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.label} — {resume.file_name}
                </option>
              ))}
            </select>

            {resumes.length === 0 && (
              <p className="mt-3 text-sm text-amber-300">
                No resume files found yet. We will build upload/manage resume
                page next.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">3. Email Subject</h2>

            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
            >
              <option value="">Choose saved subject...</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.label} — {subject.subject}
                </option>
              ))}
              <option value="__new__">+ Add new subject version</option>
            </select>

            {selectedSubjectId === "__new__" && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <input
                  value={newSubjectLabel}
                  onChange={(e) => setNewSubjectLabel(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Subject label, e.g. HiWi Simple"
                />

                <input
                  value={newSubjectText}
                  onChange={(e) => setNewSubjectText(e.target.value)}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Actual subject line"
                />
              </div>
            )}

            {selectedSubject && (
              <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                {selectedSubject.subject}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">4. Email Body</h2>

            <select
              value={selectedBodyId}
              onChange={(e) => setSelectedBodyId(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
            >
              <option value="">Choose saved email body...</option>
              {bodies.map((body) => (
                <option key={body.id} value={body.id}>
                  {body.label}
                </option>
              ))}
              <option value="__new__">+ Add new email body version</option>
            </select>

            {selectedBodyId === "__new__" && (
              <div className="mt-4 space-y-4">
                <input
                  value={newBodyLabel}
                  onChange={(e) => setNewBodyLabel(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Body label, e.g. AI professor email"
                />

                <textarea
                  value={newBodyText}
                  onChange={(e) => setNewBodyText(e.target.value)}
                  className="min-h-64 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Dear Professor..."
                />
              </div>
            )}

            {selectedBody && (
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                {selectedBody.email_body}
              </pre>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">5. Schedule</h2>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Send date and time *
                </label>

                <input
                  required
                  type="datetime-local"
                  min={getMinimumDatetimeLocal()}
                  value={sendDatetime}
                  onChange={(e) => setSendDatetime(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Choose at least 35 minutes from now because registration runs
                  every 30 minutes.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Follow-up after days
                </label>

                <input
                  type="number"
                  min="1"
                  value={followupAfterDays}
                  onChange={(e) => setFollowupAfterDays(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                />

                <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={followupRequired}
                    onChange={(e) => setFollowupRequired(e.target.checked)}
                  />
                  Follow-up required
                </label>
              </div>
            </div>
          </section>

          <button
            disabled={saving}
            className="w-full rounded-2xl bg-emerald-400 px-6 py-4 text-lg font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {saving ? "Scheduling..." : "Schedule Outreach Email"}
          </button>
        </form>
      </div>
    </main>
  );
}