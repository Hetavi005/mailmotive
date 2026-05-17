"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { OutlineIcon } from "@/components/OutlineIcon";

function LeftFeature({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: "mail" | "calendar" | "repeat" | "file";
}) {
  return (
    <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0f1728]">
        <OutlineIcon name={icon} className="h-5 w-5" />
      </div>

      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-white/72">{description}</p>
    </div>
  );
}

function MiniStat({
  title,
  subtitle,
  icon,
  className,
}: {
  title: string;
  subtitle: string;
  icon: "calendar" | "mail" | "repeat";
  className: string;
}) {
  return (
    <div className={`rounded-[22px] p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#171a21]">
          <OutlineIcon name={icon} className="h-4 w-4" />
        </div>

        <div>
          <p className="text-sm font-semibold text-[#171a21]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#657187]">{subtitle}</p>
        </div>
      </div>
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
    <main className="min-h-screen bg-[#edf3ff]">
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(165,178,232,0.38),transparent_30rem),radial-gradient(circle_at_top_left,rgba(155,255,199,0.18),transparent_26rem),linear-gradient(135deg,#edf3ff_0%,#f4f8ff_48%,#eef7fb_100%)] p-5">
        <section className="mx-auto grid min-h-[calc(100vh-40px)] max-w-6xl overflow-hidden rounded-[34px] border border-black/8 bg-white shadow-[0_24px_70px_rgba(33,49,84,0.12)] lg:grid-cols-[0.96fr_1.04fr]">
          <aside className="flex flex-col justify-between bg-[#0f1728] p-8 text-white md:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#9BFFC7] text-[#0f1728]">
                <OutlineIcon name="dashboard" className="h-5 w-5" />
              </div>

              <div>
                <p className="text-base font-semibold tracking-tight">
                  MailMotive
                </p>
                <p className="text-sm text-white/62">Automation portal</p>
              </div>
            </div>

            <div className="my-12 max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9BFFC7]">
                Personal outreach system
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.055em] text-white md:text-5xl">
                Automate outreach without losing control.
              </h1>

              <p className="mt-5 max-w-lg text-base leading-7 text-white/72">
                Manage HiWi applications, professor emails, recruiter outreach,
                working student roles, attachments, scheduled sending, and
                follow-ups in one organized workspace.
              </p>

              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                <LeftFeature
                  title="Reusable outreach"
                  description="Save subject and body versions for repeated email workflows."
                  icon="mail"
                />

                <LeftFeature
                  title="Scheduled Gmail sending"
                  description="Schedule emails and let Apps Script create the send trigger."
                  icon="calendar"
                />

                <LeftFeature
                  title="Follow-up workflow"
                  description="Track no-reply cases and continue conversations."
                  icon="repeat"
                />

                <LeftFeature
                  title="Attachment library"
                  description="Upload CVs and reuse them while composing outreach."
                  icon="file"
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/12 bg-white/8 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                Built for
              </p>
              <p className="mt-2 text-sm leading-6 text-white/78">
                HiWi applications · professor/lab emails · recruiter cold
                outreach · working student applications
              </p>
            </div>
          </aside>

          <section className="flex items-center justify-center bg-[rgba(248,251,255,0.88)] p-6 md:p-10">
            <div className="w-full max-w-[460px]">
              <div className="mb-7 lg:hidden">
                <div className="inline-flex items-center gap-3 rounded-full border border-black/8 bg-white px-4 py-2 shadow-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9BFFC7]">
                    <OutlineIcon name="dashboard" className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#171a21]">
                    MailMotive
                  </span>
                </div>
              </div>

              <div className="rounded-[30px] border border-black/8 bg-white p-7 shadow-[0_20px_55px_rgba(33,49,84,0.12)] md:p-8">
                <div>
                  <p className="page-eyebrow">
                    {mode === "login" ? "Welcome back" : "Create workspace"}
                  </p>

                  <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#171a21]">
                    {mode === "login"
                      ? "Login to MailMotive"
                      : "Create your account"}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#657187]">
                    {mode === "login"
                      ? "Continue managing scheduled emails, contacts, attachments, and follow-ups."
                      : "Start your personal outreach automation workspace."}
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
                        : "text-[#657187] hover:text-[#171a21]"
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
                        : "text-[#657187] hover:text-[#171a21]"
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
                        placeholder="Your name"
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

              <div className="mt-5 grid gap-3">
                <MiniStat
                  title="Schedule Gmail sends"
                  subtitle="Create timed outreach with trigger-based delivery."
                  icon="calendar"
                  className="bg-[#dbe6ff]"
                />

                <MiniStat
                  title="Track every email"
                  subtitle="Monitor scheduled, ready, sent, and failed messages."
                  icon="mail"
                  className="bg-[#dcf5e7]"
                />

                <MiniStat
                  title="Manage follow-ups"
                  subtitle="Continue no-reply workflows without losing context."
                  icon="repeat"
                  className="bg-[#f4dceb]"
                />
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}