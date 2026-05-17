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
  created_at: string;
};

const REPLY_STATUS_OPTIONS = [
  "No Reply",
  "Replied",
  "Positive",
  "Rejected",
  "Closed",
];

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString();
}

function getReplyStatusClass(status: string) {
  if (status === "Positive") {
    return "bg-[#dcf5e7] text-[#171a21]";
  }

  if (status === "Rejected") {
    return "bg-red-50 text-red-700";
  }

  if (status === "Replied") {
    return "bg-[#dbe6ff] text-[#171a21]";
  }

  if (status === "Closed") {
    return "bg-[#eee8df] text-[#171a21]";
  }

  return "bg-white text-[#657187]";
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

function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string;
  value: number;
  icon: "people" | "mail" | "check" | "warning";
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

export default function ProfessorsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [form, setForm] = useState({
    professor_name: "",
    email: "",
    university: "",
    category: "",
    research_area: "",
    website_url: "",
    notes: "",
  });

  const filteredProfessors = useMemo(() => {
    const text = searchText.toLowerCase().trim();

    return professors.filter((professor) => {
      const matchesStatus =
        statusFilter === "All" || professor.reply_status === statusFilter;

      const matchesSearch =
        !text ||
        professor.professor_name.toLowerCase().includes(text) ||
        professor.email.toLowerCase().includes(text) ||
        professor.university?.toLowerCase().includes(text) ||
        professor.category?.toLowerCase().includes(text) ||
        professor.research_area?.toLowerCase().includes(text) ||
        professor.notes?.toLowerCase().includes(text);

      return matchesStatus && matchesSearch;
    });
  }, [professors, searchText, statusFilter]);

  const stats = useMemo(() => {
    const noReply = professors.filter(
      (professor) => professor.reply_status === "No Reply"
    ).length;

    const replied = professors.filter((professor) =>
      ["Replied", "Positive", "Rejected", "Closed"].includes(
        professor.reply_status
      )
    ).length;

    const positive = professors.filter(
      (professor) => professor.reply_status === "Positive"
    ).length;

    return {
      total: professors.length,
      noReply,
      replied,
      positive,
    };
  }, [professors]);

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

      await loadProfessors(currentUserId);

      setLoading(false);
    }

    initialize();
  }, [router]);

  async function loadProfessors(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    const { data, error } = await supabase
      .from("professors")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading contacts: " + error.message);
      return;
    }

    setProfessors((data ?? []) as Professor[]);
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleAddProfessor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) {
      setMessage("You are not logged in.");
      return;
    }

    if (!form.professor_name.trim()) {
      setMessage("Name is required.");
      return;
    }

    if (!form.email.trim()) {
      setMessage("Email is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("professors").insert({
      user_id: userId,
      professor_name: form.professor_name.trim(),
      email: form.email.trim(),
      university: form.university.trim() || null,
      category: form.category.trim() || null,
      research_area: form.research_area.trim() || null,
      website_url: form.website_url.trim() || null,
      notes: form.notes.trim() || null,
      reply_status: "No Reply",
    });

    if (error) {
      setMessage("Error adding contact: " + error.message);
      setSaving(false);
      return;
    }

    setForm({
      professor_name: "",
      email: "",
      university: "",
      category: "",
      research_area: "",
      website_url: "",
      notes: "",
    });

    await loadProfessors(userId);

    setMessage("Contact added successfully.");
    setSaving(false);
  }

  async function handleDeleteProfessor(id: string) {
    const confirmed = window.confirm(
      "Delete this contact? Related emails may also be deleted because of database cascade rules."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("professors").delete().eq("id", id);

    if (error) {
      setMessage("Error deleting contact: " + error.message);
      return;
    }

    await loadProfessors();
    setMessage("Contact deleted.");
  }

  async function handleReplyStatusChange(id: string, replyStatus: string) {
    const { error } = await supabase
      .from("professors")
      .update({
        reply_status: replyStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setMessage("Error updating reply status: " + error.message);
      return;
    }

    await loadProfessors();
    setMessage("Reply status updated.");
  }

  if (loading) {
    return (
      <AppShell activePage="contacts" email={userEmail}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="soft-card bg-white p-8 text-center">
            <div className="icon-box mx-auto h-12 w-12 bg-[#dcf5e7]">
              <OutlineIcon name="people" />
            </div>
            <p className="page-eyebrow mt-4">Contacts</p>
            <h1 className="mt-2 text-2xl font-semibold text-black">
              Loading contacts
            </h1>
            <p className="mt-3 text-sm text-[#657187]">
              Fetching professors, recruiters, HR contacts, and lab targets.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="contacts" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Contact database</p>
          <h1 className="page-title mt-2">Contacts</h1>
          <p className="page-description">
            Manage professors, lab contacts, recruiters, HR contacts, and
            companies you want to reach through MailMotive.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadProfessors()}
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
        <span className="status-pill bg-[#dcf5e7]">
          {stats.total} total contacts
        </span>
        <span className="status-pill bg-[#dbe6ff]">
          {stats.noReply} no reply
        </span>
        <span className="status-pill bg-[#f4dceb]">
          {stats.replied} replied / closed
        </span>
        <span className="status-pill bg-white/80">
          {filteredProfessors.length} visible
        </span>
      </div>

      {message ? (
        <div className="mt-6 rounded-[22px] border border-black/8 bg-white p-4">
          <p className="text-sm font-semibold text-[#171a21]">{message}</p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <aside className="space-y-5">
          <div className="soft-card bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Overview</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Contact status
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Keep track of who is still waiting for a response and who has
                  replied.
                </p>
              </div>

              <div className="icon-box h-12 w-12 bg-[#dcf5e7]">
                <OutlineIcon name="people" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatCard
                label="Total"
                value={stats.total}
                icon="people"
                className="bg-[#dcf5e7]"
              />

              <StatCard
                label="No Reply"
                value={stats.noReply}
                icon="mail"
                className="bg-[#dbe6ff]"
              />

              <StatCard
                label="Replied"
                value={stats.replied}
                icon="check"
                className="bg-[#f4dceb]"
              />

              <StatCard
                label="Positive"
                value={stats.positive}
                icon="check"
                className="bg-[#eef3d9]"
              />
            </div>
          </div>

          <div className="soft-card bg-[rgba(243,248,255,0.76)] p-6">
            <p className="page-eyebrow">Add contact</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
              Save a new target
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#657187]">
              Add professors, recruiters, HR contacts, company contacts, or lab
              members here.
            </p>

            <form onSubmit={handleAddProfessor} className="mt-5 space-y-4">
              <div>
                <FieldLabel title="Name" required />
                <input
                  required
                  value={form.professor_name}
                  onChange={(e) =>
                    updateForm("professor_name", e.target.value)
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
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  className="input"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <FieldLabel title="University / Company" />
                <input
                  value={form.university}
                  onChange={(e) => updateForm("university", e.target.value)}
                  className="input"
                  placeholder="FAU, TUM, Siemens..."
                />
              </div>

              <div>
                <FieldLabel title="Category" />
                <input
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  className="input"
                  placeholder="Professor, Recruiter, HR, Lab..."
                />
              </div>

              <div>
                <FieldLabel title="Research / Role area" />
                <input
                  value={form.research_area}
                  onChange={(e) => updateForm("research_area", e.target.value)}
                  className="input"
                  placeholder="AI, HCI, Data Analytics..."
                />
              </div>

              <div>
                <FieldLabel title="Website URL" />
                <input
                  value={form.website_url}
                  onChange={(e) => updateForm("website_url", e.target.value)}
                  className="input"
                  placeholder="https://..."
                />
              </div>

              <div>
                <FieldLabel title="Notes" />
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  className="textarea min-h-28"
                  placeholder="Why this contact is useful, what to mention, personalization notes..."
                />
              </div>

              <button
                disabled={saving}
                className="btn btn-dark w-full disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                <OutlineIcon name="plus" className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Add Contact"}
              </button>
            </form>
          </div>
        </aside>

        <section className="soft-card bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Saved contacts</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                Contact list
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#657187]">
                Showing {filteredProfessors.length} of {professors.length} saved
                contacts.
              </p>
            </div>

            <Link href="/outreach/new" className="btn btn-light">
              <OutlineIcon name="compose" className="mr-2 h-4 w-4" />
              Schedule email
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
            <div>
              <FieldLabel title="Search contacts" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input"
                placeholder="Search name, email, company, category, notes..."
              />
            </div>

            <div>
              <FieldLabel title="Reply status" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="select"
              >
                <option value="All">All</option>
                {REPLY_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {filteredProfessors.length === 0 ? (
              <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-8 text-center">
                <div className="icon-box mx-auto h-12 w-12 bg-white">
                  <OutlineIcon name="people" />
                </div>

                <p className="mt-4 text-sm font-semibold text-[#171a21]">
                  No contacts found
                </p>

                <p className="mt-2 text-sm text-[#657187]">
                  Add a new contact or clear the filters.
                </p>
              </div>
            ) : (
              filteredProfessors.map((professor) => (
                <article
                  key={professor.id}
                  className="rounded-[26px] border border-black/8 bg-[#f9fbff] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getReplyStatusClass(
                            professor.reply_status
                          )}`}
                        >
                          {professor.reply_status || "No Reply"}
                        </span>

                        {professor.category ? (
                          <span className="rounded-full bg-[#dbe6ff] px-3 py-1 text-xs font-medium text-[#171a21]">
                            {professor.category}
                          </span>
                        ) : null}

                        {professor.university ? (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#657187]">
                            {professor.university}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-4 break-words text-lg font-semibold leading-7 text-[#171a21]">
                        {professor.professor_name}
                      </h3>

                      <p className="mt-1 break-all text-sm leading-6 text-[#657187]">
                        {professor.email}
                      </p>

                      {professor.research_area ? (
                        <p className="mt-3 text-sm leading-6 text-[#657187]">
                          <span className="font-semibold text-[#171a21]">
                            Area:
                          </span>{" "}
                          {professor.research_area}
                        </p>
                      ) : null}

                      {professor.notes ? (
                        <p className="mt-3 rounded-2xl bg-white p-3 text-sm leading-6 text-[#657187]">
                          {professor.notes}
                        </p>
                      ) : null}

                      <p className="mt-3 text-xs text-[#657187]">
                        Added {formatDate(professor.created_at)}
                      </p>
                    </div>

                    <div className="w-full space-y-3 sm:w-56">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                          Reply status
                        </label>

                        <select
                          value={professor.reply_status || "No Reply"}
                          onChange={(e) =>
                            handleReplyStatusChange(
                              professor.id,
                              e.target.value
                            )
                          }
                          className="select"
                        >
                          {REPLY_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={`/outreach/new`}
                          className="rounded-2xl border border-black/8 bg-[#dbe6ff] px-3 py-2 text-center text-xs font-semibold text-[#171a21] transition hover:bg-[#cbd9ff]"
                        >
                          Email
                        </Link>

                        <button
                          onClick={() => handleDeleteProfessor(professor.id)}
                          className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          type="button"
                        >
                          Delete
                        </button>
                      </div>

                      {professor.website_url ? (
                        <a
                          href={professor.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-black/8 bg-white px-3 py-2 text-center text-xs font-semibold text-[#171a21] transition hover:bg-[#f6f8fc]"
                        >
                          Open website
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </AppShell>
  );
}