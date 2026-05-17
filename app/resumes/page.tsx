"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ResumeFile = {
  id: string;
  user_id: string;
  label: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function ResumesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
        return;
      }

      const currentUserId = data.session.user.id;
      setUserId(currentUserId);

      await loadResumes(currentUserId);
      setLoading(false);
    }

    initialize();
  }, [router]);

  async function loadResumes(currentUserId?: string) {
    const id = currentUserId || userId;

    if (!id) return;

    const { data, error } = await supabase
      .from("resume_files")
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("Error loading files: " + error.message);
      return;
    }

    setResumes(data ?? []);
  }

  function createSafeFileName(fileName: string) {
    return fileName
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!userId) {
      setMessage("You are not logged in.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please choose a file first.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File is too large. Please upload a file under 10 MB.");
      setMessage("File is too large. Please upload a file under 10 MB.");
      return;
    }

    setUploading(true);
    setMessage("");

    try {
      const safeFileName = createSafeFileName(selectedFile.name);
      const timestamp = Date.now();
      const filePath = `${userId}/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
         .from("Resumes")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Storage upload failed: " + uploadError.message);
      }

  const finalLabel =
  selectedFile.name.replace(/\.[^/.]+$/, "") || "Uploaded file";

      const { error: insertError } = await supabase.from("resume_files").insert({
        user_id: userId,
        label: finalLabel,
        file_name: selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type || null,
        file_size: selectedFile.size,
      });

      if (insertError) {
        throw new Error("File metadata insert failed: " + insertError.message);
      }

      setSelectedFile(null);

      const fileInput = document.getElementById("file-upload") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      setMessage("File uploaded successfully.");
      await loadResumes(userId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Something went wrong.";
      setMessage(errorMessage);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(resume: ResumeFile) {
    const confirmed = window.confirm(
      "Delete this file from MailMotive? This removes it from storage and from the resume list."
    );

    if (!confirmed) return;

    const { error: storageError } = await supabase.storage
      .from("Resumes")
      .remove([resume.file_path]);

    if (storageError) {
      setMessage("Storage delete failed: " + storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("resume_files")
      .delete()
      .eq("id", resume.id);

    if (dbError) {
      setMessage("Database delete failed: " + dbError.message);
      return;
    }

    setMessage("File deleted.");
    await loadResumes();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        Loading files...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold">Resumes & Attachments</h1>
            <p className="mt-2 text-slate-400">
              Upload files once. Use clear file names like Hetavi Patel [DAS].pdf so they are easy to select later.
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
              href="/emails"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900"
            >
              Emails
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
            onSubmit={handleUpload}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
          >
            <h2 className="text-xl font-semibold">Upload file</h2>
            <p className="mt-1 text-sm text-slate-400">
              Use clear file names because MailMotive will use the file name as the display label.
            </p>

            <div className="mt-6 space-y-4">

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  File
                </label>
                <input
                  id="file-upload"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-emerald-400"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Maximum file size: 10 MB. Smaller attachments are better for deliverability.
                </p>
              </div>

              {selectedFile && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                  <p>Selected: {selectedFile.name}</p>
                  <p>Size: {formatFileSize(selectedFile.size)}</p>
                  <p>Type: {selectedFile.type || "Unknown"}</p>
                </div>
              )}

              <button
                disabled={uploading}
                className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </form>

          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Saved files</h2>
            <p className="mt-1 text-sm text-slate-400">
              Total files: {resumes.length}
            </p>

            <div className="mt-6 space-y-4">
              {resumes.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-400">
                  No files uploaded yet.
                </div>
              ) : (
                resumes.map((resume) => (
                  <article
                    key={resume.id}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{resume.label}</h3>
                        <p className="mt-1 text-sm text-slate-400">
                          {resume.file_name}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                            {formatFileSize(resume.file_size)}
                          </span>

                          {resume.file_type && (
                            <span className="rounded-full bg-blue-400/10 px-3 py-1 text-blue-300">
                              {resume.file_type}
                            </span>
                          )}

                          <span className="rounded-full bg-purple-400/10 px-3 py-1 text-purple-300">
                            {formatDateTime(resume.created_at)}
                          </span>
                        </div>

                        <p className="mt-3 break-all text-xs text-slate-600">
                          Path: {resume.file_path}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDelete(resume)}
                        className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}