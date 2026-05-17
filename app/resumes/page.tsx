"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";
import { supabase } from "@/lib/supabaseClient";

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

function getFileKind(fileType: string | null, fileName: string) {
  const lowerName = fileName.toLowerCase();

  if (fileType?.includes("pdf") || lowerName.endsWith(".pdf")) {
    return "PDF";
  }

  if (
    fileType?.includes("word") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx")
  ) {
    return "Word";
  }

  if (
    fileType?.includes("image") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg")
  ) {
    return "Image";
  }

  return "File";
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
  value: string | number;
  icon: "file" | "upload" | "attachment" | "database" | "search";
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

export default function ResumesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const [searchText, setSearchText] = useState("");

  const filteredFiles = useMemo(() => {
    const text = searchText.toLowerCase().trim();

    if (!text) return resumes;

    return resumes.filter((resume) => {
      return (
        resume.label.toLowerCase().includes(text) ||
        resume.file_name.toLowerCase().includes(text) ||
        resume.file_type?.toLowerCase().includes(text) ||
        resume.file_path.toLowerCase().includes(text)
      );
    });
  }, [resumes, searchText]);

  const stats = useMemo(() => {
    const totalBytes = resumes.reduce(
      (sum, resume) => sum + (resume.file_size ?? 0),
      0
    );

    const pdfCount = resumes.filter((resume) => {
      return (
        resume.file_type?.includes("pdf") ||
        resume.file_name.toLowerCase().endsWith(".pdf")
      );
    }).length;

    return {
      total: resumes.length,
      pdfCount,
      totalSize: formatFileSize(totalBytes),
      visible: filteredFiles.length,
    };
  }, [resumes, filteredFiles.length]);

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

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
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

      const fileInput = document.getElementById(
        "file-upload"
      ) as HTMLInputElement | null;

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
      "Delete this file from MailMotive? This removes it from storage and from the file list."
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

  if (loading) {
    return (
      <AppShell activePage="files" email={userEmail}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="soft-card bg-white p-8 text-center">
            <div className="icon-box mx-auto h-12 w-12 bg-[#eef3d9]">
              <OutlineIcon name="file" />
            </div>

            <p className="page-eyebrow mt-4">Files</p>

            <h1 className="mt-2 text-2xl font-semibold text-black">
              Loading attachments
            </h1>

            <p className="mt-3 text-sm text-[#657187]">
              Fetching CVs, resumes, and saved outreach attachments.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePage="files" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">Attachment library</p>
          <h1 className="page-title mt-2">Files</h1>
          <p className="page-description">
            Upload and manage resumes, CVs, and other attachments once, then
            reuse them while scheduling outreach emails.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => loadResumes()}
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
        <span className="status-pill bg-[#eef3d9]">
          {stats.total} total files
        </span>
        <span className="status-pill bg-[#dbe6ff]">
          {stats.pdfCount} PDF files
        </span>
        <span className="status-pill bg-[#dcf5e7]">
          {stats.totalSize} stored
        </span>
        <span className="status-pill bg-white/80">
          {stats.visible} visible
        </span>
      </div>

      {message ? (
        <div
          className={`mt-6 rounded-[22px] border p-4 ${
            message.toLowerCase().includes("successfully") ||
            message.toLowerCase().includes("deleted")
              ? "border-green-200 bg-[#dcf5e7]"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-sm font-semibold text-[#171a21]">{message}</p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <aside className="space-y-5">
          <form
            onSubmit={handleUpload}
            className="soft-card bg-[rgba(243,248,255,0.76)] p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Upload</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Add a new file
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Use clear file names so they are easy to select later while
                  composing outreach.
                </p>
              </div>

              <div className="icon-box h-12 w-12 bg-[#eef3d9]">
                <OutlineIcon name="upload" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <FieldLabel title="Choose file" required />

                <input
                  id="file-upload"
                  type="file"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] ?? null)
                  }
                  className="input"
                />

                <p className="help-text">
                  Maximum file size: 10 MB. Smaller attachments are better for
                  deliverability.
                </p>
              </div>

              {selectedFile ? (
                <div className="rounded-[22px] border border-black/8 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="icon-box h-10 w-10 bg-[#dbe6ff]">
                      <OutlineIcon name="file" className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[#171a21]">
                        {selectedFile.name}
                      </p>

                      <p className="mt-1 text-xs text-[#657187]">
                        {formatFileSize(selectedFile.size)} ·{" "}
                        {selectedFile.type || "Unknown type"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-black/12 bg-white/70 p-5 text-center">
                  <div className="icon-box mx-auto h-10 w-10 bg-white">
                    <OutlineIcon name="attachment" className="h-4 w-4" />
                  </div>

                  <p className="mt-3 text-sm font-semibold text-[#171a21]">
                    No file selected
                  </p>

                  <p className="mt-1 text-xs text-[#657187]">
                    Select a CV, resume, or supporting document.
                  </p>
                </div>
              )}

              <button
                disabled={uploading}
                className="btn btn-dark w-full disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                <OutlineIcon name="upload" className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </form>

          <div className="soft-card bg-white p-6">
            <p className="page-eyebrow">Library overview</p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
              File status
            </h2>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatCard
                label="Files"
                value={stats.total}
                icon="file"
                className="bg-[#eef3d9]"
              />

              <StatCard
                label="PDFs"
                value={stats.pdfCount}
                icon="attachment"
                className="bg-[#dbe6ff]"
              />

              <StatCard
                label="Stored"
                value={stats.totalSize}
                icon="database"
                className="bg-[#dcf5e7]"
              />

              <StatCard
                label="Visible"
                value={stats.visible}
                icon="search"
                className="bg-[#f4dceb]"
              />
            </div>
          </div>

          <div className="soft-card bg-[#dcf5e7] p-5">
            <div className="flex items-start gap-3">
              <div className="icon-box h-10 w-10 bg-white/85">
                <OutlineIcon name="check" className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#171a21]">
                  Naming tip
                </p>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  Use file names like{" "}
                  <span className="font-semibold text-[#171a21]">
                    Hetavi_Patel_CV_Data_Analytics.pdf
                  </span>{" "}
                  so you can quickly identify them in the outreach composer.
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="soft-card bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Saved files</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                Attachment list
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#657187]">
                Showing {filteredFiles.length} of {resumes.length} uploaded
                files.
              </p>
            </div>

            <Link href="/outreach/new" className="btn btn-light">
              <OutlineIcon name="compose" className="mr-2 h-4 w-4" />
              Use in outreach
            </Link>
          </div>

          <div className="mt-5">
            <FieldLabel title="Search files" />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="input"
              placeholder="Search by label, file name, type, or path..."
            />
          </div>

          <div className="mt-6 space-y-4">
            {filteredFiles.length === 0 ? (
              <div className="rounded-[24px] border border-black/8 bg-[#f6f8fc] p-8 text-center">
                <div className="icon-box mx-auto h-12 w-12 bg-white">
                  <OutlineIcon name="file" />
                </div>

                <p className="mt-4 text-sm font-semibold text-[#171a21]">
                  No files found
                </p>

                <p className="mt-2 text-sm text-[#657187]">
                  Upload a file or clear your search filter.
                </p>
              </div>
            ) : (
              filteredFiles.map((resume) => (
                <article
                  key={resume.id}
                  className="rounded-[26px] border border-black/8 bg-[#f9fbff] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-4">
                        <div className="icon-box h-12 w-12 shrink-0 bg-[#eef3d9]">
                          <OutlineIcon name="file" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[#dbe6ff] px-3 py-1 text-xs font-semibold text-[#171a21]">
                              {getFileKind(resume.file_type, resume.file_name)}
                            </span>

                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#657187]">
                              {formatFileSize(resume.file_size)}
                            </span>

                            <span className="rounded-full bg-[#dcf5e7] px-3 py-1 text-xs font-medium text-[#171a21]">
                              {formatDateTime(resume.created_at)}
                            </span>
                          </div>

                          <h3 className="mt-4 break-words text-lg font-semibold leading-7 text-[#171a21]">
                            {resume.label}
                          </h3>

                          <p className="mt-1 break-words text-sm leading-6 text-[#657187]">
                            {resume.file_name}
                          </p>

                          <p className="mt-3 break-all rounded-2xl bg-white p-3 text-xs leading-5 text-[#657187]">
                            <span className="font-semibold text-[#171a21]">
                              Storage path:
                            </span>{" "}
                            {resume.file_path}
                          </p>

                          {resume.file_type ? (
                            <p className="mt-2 text-xs text-[#657187]">
                              MIME type: {resume.file_type}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(resume)}
                      className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      type="button"
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
    </AppShell>
  );
}