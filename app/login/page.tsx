"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { OutlineIcon } from "@/components/OutlineIcon";

function FeatureItem({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description: string;
  icon: "mail" | "calendar" | "repeat" | "file";
  className: string;
}) {
  return (
    <div className={`rounded-[24px] p-4 ${className}`}>
      <div className="icon-box h-10 w-10 bg-white/85">
        <OutlineIcon name={icon} className="h-4 w-4" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-[#171a21]">{title}</h3>

      <p className="mt-1 text-xs leading-5 text-[#657187]">{description}</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          setMessage("Signup error: " + error.message);
          return;
        }

        console.log("Signup data:", data);

        setMessage("Account created. Now switch to Login and sign in.");
        setMode("login");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage("Login error: " + error.message);
        return;
      }

      console.log("Login data:", data);

      if (!data.session) {
        setMessage("Login succeeded but no session was created.");
        return;
      }

      setMessage("Login successful. Redirecting...");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong. Check browser console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell min-h-screen">
      <div className="grid min-h-screen p-[18px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-[32px] bg-[#0f1728] p-8 text-white shadow-[0_24px_70px_rgba(7,13,25,0.28)] lg:flex lg:flex-col">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9BFFC7] text-black">
              <OutlineIcon name="dashboard" />
            </div>

            <div>
              <p className="text-sm font-semibold tracking-wide">MailMotive</p>
              <p className="text-xs text-white/45">Automation portal</p>
            </div>
          </div>

          <div className="my-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9BFFC7]">
              Personal outreach system
            </p>

            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-[-0.06em]">
              Automate outreach without losing control.
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-white/62">
              Manage HiWi applications, professor emails, recruiter outreach,
              working student roles, attachments, scheduling, and follow-ups in
              one organized workspace.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <FeatureItem
                title="Reusable emails"
                description="Save subject and body versions for repeated outreach."
                icon="mail"
                className="bg-white/8"
              />

              <FeatureItem
                title="Scheduled sending"
                description="Schedule messages and let Apps Script handle Gmail triggers."
                icon="calendar"
                className="bg-white/8"
              />

              <FeatureItem
                title="Follow-up workflow"
                description="Track no-reply cases and schedule next steps."
                icon="repeat"
                className="bg-white/8"
              />

              <FeatureItem
                title="Attachment library"
                description="Upload CVs and reuse them while composing emails."
                icon="file"
                className="bg-white/8"
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
              Built for
            </p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              HiWi applications · professor/lab emails · HR and recruiter cold
              outreach · working student applications
            </p>
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-36px)] items-center justify-center rounded-[32px] bg-[rgba(248,251,255,0.82)] p-6 shadow-[0_24px_70px_rgba(33,49,84,0.08)] backdrop-blur lg:rounded-l-none">
          <div className="w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <div className="inline-flex items-center gap-3 rounded-full border border-black/8 bg-white px-4 py-2 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9BFFC7]">
                  <OutlineIcon name="dashboard" className="h-4 w-4" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171a21]">
                  MailMotive
                </span>
              </div>
            </div>

            <div className="soft-card bg-white p-7">
              <div>
                <p className="page-eyebrow">Welcome back</p>

                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#171a21]">
                  {mode === "login" ? "Login to MailMotive" : "Create account"}
                </h1>

                <p className="mt-3 text-sm leading-6 text-[#657187]">
                  {mode === "login"
                    ? "Continue managing your outreach pipeline and scheduled emails."
                    : "Create your workspace for email automation and follow-up tracking."}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 rounded-[18px] bg-[#f6f8fc] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setMessage("");
                  }}
                  className={`rounded-[15px] px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-[#171a21] shadow-sm"
                      : "text-[#657187]"
                  }`}
                >
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setMessage("");
                  }}
                  className={`rounded-[15px] px-4 py-2.5 text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-[#171a21] shadow-sm"
                      : "text-[#657187]"
                  }`}
                >
                  Sign up
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {mode === "signup" ? (
                  <div>
                    <label className="label">Full name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input"
                      placeholder="Hetavi Patel"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="Minimum 6 characters"
                  />
                </div>

                {message ? (
                  <div
                    className={`rounded-[20px] border p-4 ${
                      message.toLowerCase().includes("successful") ||
                      message.toLowerCase().includes("created")
                        ? "border-green-200 bg-[#dcf5e7]"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#171a21]">
                      {message}
                    </p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-dark w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                      ? "Login"
                      : "Create account"}
                </button>
              </form>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] bg-[#dbe6ff] p-4">
                <p className="text-sm font-semibold text-[#171a21]">Schedule</p>
                <p className="mt-1 text-xs text-[#657187]">Timed Gmail sends</p>
              </div>

              <div className="rounded-[22px] bg-[#dcf5e7] p-4">
                <p className="text-sm font-semibold text-[#171a21]">Track</p>
                <p className="mt-1 text-xs text-[#657187]">Status updates</p>
              </div>

              <div className="rounded-[22px] bg-[#f4dceb] p-4">
                <p className="text-sm font-semibold text-[#171a21]">Follow</p>
                <p className="mt-1 text-xs text-[#657187]">No-reply workflow</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}