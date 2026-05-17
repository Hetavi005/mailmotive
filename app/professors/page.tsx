"use client";

import { useEffect, useState } from "react";
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
  created_at: string;
};

export default function ProfessorsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    professor_name: "",
    email: "",
    university: "",
    category: "",
    research_area: "",
    website_url: "",
    notes: "",
  });

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      setUserId(data.session.user.id);
      await loadProfessors(data.session.user.id);
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

  function updateForm(field: string, value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleAddProfessor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) {
      setMessage("You are not logged in.");
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
      setMessage("Error adding professor: " + error.message);
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
    setMessage("Professor added successfully.");
    setSaving(false);
  }

  async function handleDeleteProfessor(id: string) {
    const confirmed = window.confirm(
      "Delete this professor? Related emails may also be deleted because of database cascade rules."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("professors").delete().eq("id", id);

    if (error) {
      setMessage("Error deleting professor: " + error.message);
      return;
    }

    if (userId) {
      await loadProfessors(userId);
    }

    setMessage("Professor deleted.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading professors...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Professors</h1>
            <p className="mt-2 text-slate-400">
              Add and manage professor contacts for HiWi outreach.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Dashboard
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

        <section className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <form
            onSubmit={handleAddProfessor}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h2 className="text-xl font-semibold">Add Professor</h2>
            <p className="mt-1 text-sm text-slate-400">
              Store the contact first. You will schedule emails in the next step.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Professor name *
                </label>
                <input
                  required
                  value={form.professor_name}
                  onChange={(e) => updateForm("professor_name", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Prof. Dr. Müller"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Email *
                </label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="professor@university.de"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  University
                </label>
                <input
                  value={form.university}
                  onChange={(e) => updateForm("university", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="TU Munich"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Category
                </label>
                <input
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="AI, Robotics, HCI, Data Science"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Research area
                </label>
                <input
                  value={form.research_area}
                  onChange={(e) => updateForm("research_area", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Computer Vision, NLP, Human-AI Interaction"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Website URL
                </label>
                <input
                  value={form.website_url}
                  onChange={(e) => updateForm("website_url", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  className="min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400"
                  placeholder="Why this professor is relevant, paper name, lab info..."
                />
              </div>

              <button
                disabled={saving}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Professor"}
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Professor List</h2>
            <p className="mt-1 text-sm text-slate-400">
              Total professors: {professors.length}
            </p>

            <div className="mt-6 space-y-4">
              {professors.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-400">
                  No professors added yet.
                </div>
              ) : (
                professors.map((professor) => (
                  <div
                    key={professor.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">
                          {professor.professor_name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {professor.email}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {professor.university && (
                            <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                              {professor.university}
                            </span>
                          )}

                          {professor.category && (
                            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">
                              {professor.category}
                            </span>
                          )}

                          {professor.reply_status && (
                            <span className="rounded-full bg-blue-400/10 px-3 py-1 text-blue-300">
                              {professor.reply_status}
                            </span>
                          )}
                        </div>

                        {professor.research_area && (
                          <p className="mt-3 text-sm text-slate-300">
                            Research: {professor.research_area}
                          </p>
                        )}

                        {professor.notes && (
                          <p className="mt-2 text-sm text-slate-500">
                            {professor.notes}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteProfessor(professor.id)}
                        className="rounded-lg border border-red-900/60 px-3 py-1 text-xs text-red-300 hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}