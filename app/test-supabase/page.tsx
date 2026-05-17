"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { OutlineIcon } from "@/components/OutlineIcon";
import { supabase } from "@/lib/supabaseClient";

type TestStatus = "testing" | "success" | "error";

export default function TestSupabasePage() {
  const [status, setStatus] = useState("Testing Supabase connection...");
  const [testStatus, setTestStatus] = useState<TestStatus>("testing");
  const [profilesCount, setProfilesCount] = useState<number | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState("Checking session...");
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    runTest();
  }, []);

  async function runTest() {
    setTestStatus("testing");
    setStatus("Testing Supabase connection...");
    setProfilesCount(null);
    setLastChecked(null);

    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData.session) {
      setUserEmail(sessionData.session.user.email ?? null);
      setSessionStatus("Authenticated session found.");
    } else {
      setUserEmail(null);
      setSessionStatus("No active session found.");
    }

    const { data, error } = await supabase.from("profiles").select("id");

    if (error) {
      setTestStatus("error");
      setStatus(`Supabase error: ${error.message}`);
      setLastChecked(new Date().toLocaleString());
      return;
    }

    setProfilesCount(data?.length ?? 0);
    setTestStatus("success");
    setStatus("Supabase connection successful.");
    setLastChecked(new Date().toLocaleString());
  }

  return (
    <AppShell activePage="test" email={userEmail}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="page-eyebrow">System health check</p>
          <h1 className="page-title mt-2">Supabase Test</h1>
          <p className="page-description">
            Verify that MailMotive can connect to Supabase, read protected data,
            and detect the current authentication session.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={runTest} className="btn btn-light" type="button">
            <OutlineIcon name="refresh" className="mr-2 h-4 w-4" />
            Run test
          </button>

          <Link href="/dashboard" className="btn btn-dark">
            <OutlineIcon name="dashboard" className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        <span
          className={`status-pill ${
            testStatus === "success"
              ? "bg-[#dcf5e7]"
              : testStatus === "error"
                ? "bg-red-50"
                : "bg-[#dbe6ff]"
          }`}
        >
          {testStatus === "success"
            ? "Connection healthy"
            : testStatus === "error"
              ? "Connection issue"
              : "Testing"}
        </span>

        <span className="status-pill bg-white/80">
          {userEmail ? "Logged in" : "No session"}
        </span>

        {lastChecked ? (
          <span className="status-pill bg-[#eef3d9]">
            Checked {lastChecked}
          </span>
        ) : null}
      </div>

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <aside className="space-y-5">
          <div className="soft-card bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="page-eyebrow">Connection result</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                  Database status
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  This checks whether the frontend can query the Supabase
                  profiles table using the current session and RLS rules.
                </p>
              </div>

              <div
                className={`icon-box h-12 w-12 ${
                  testStatus === "success"
                    ? "bg-[#dcf5e7]"
                    : testStatus === "error"
                      ? "bg-red-50"
                      : "bg-[#dbe6ff]"
                }`}
              >
                <OutlineIcon
                  name={
                    testStatus === "success"
                      ? "check"
                      : testStatus === "error"
                        ? "warning"
                        : "database"
                  }
                />
              </div>
            </div>

            <div
              className={`mt-6 rounded-[24px] border p-5 ${
                testStatus === "success"
                  ? "border-green-200 bg-[#dcf5e7]"
                  : testStatus === "error"
                    ? "border-red-200 bg-red-50"
                    : "border-black/8 bg-[#dbe6ff]"
              }`}
            >
              <p className="text-sm font-semibold text-[#171a21]">{status}</p>
            </div>
          </div>

          <div className="soft-card bg-[rgba(243,248,255,0.76)] p-6">
            <p className="page-eyebrow">Session</p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
              Auth context
            </h2>

            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-black/8 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                  Session status
                </p>
                <p className="mt-2 text-sm font-medium text-[#171a21]">
                  {sessionStatus}
                </p>
              </div>

              <div className="rounded-[22px] border border-black/8 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#657187]">
                  Current email
                </p>
                <p className="mt-2 break-all text-sm font-medium text-[#171a21]">
                  {userEmail ?? "Not logged in"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="soft-card bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="page-eyebrow">RLS visibility</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#171a21]">
                Profiles table check
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#657187]">
                Row Level Security protects the profiles table. If you are not
                logged in, seeing zero visible profiles is normal.
              </p>
            </div>

            <div className="icon-box h-12 w-12 bg-[#eef3d9]">
              <OutlineIcon name="database" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] bg-[#eef3d9] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="icon-box h-10 w-10 bg-white/85">
                  <OutlineIcon name="database" className="h-4 w-4" />
                </div>

                <p className="text-3xl font-semibold text-[#171a21]">
                  {profilesCount ?? "—"}
                </p>
              </div>

              <p className="mt-4 text-sm font-semibold text-[#171a21]">
                Profiles visible
              </p>

              <p className="mt-1 text-xs leading-5 text-[#657187]">
                Number of profile rows visible to the current Supabase session.
              </p>
            </div>

            <div className="rounded-[26px] bg-[#dbe6ff] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="icon-box h-10 w-10 bg-white/85">
                  <OutlineIcon name="user" className="h-4 w-4" />
                </div>

                <p className="text-3xl font-semibold text-[#171a21]">
                  {userEmail ? "Yes" : "No"}
                </p>
              </div>

              <p className="mt-4 text-sm font-semibold text-[#171a21]">
                Authenticated
              </p>

              <p className="mt-1 text-xs leading-5 text-[#657187]">
                Whether the browser currently has an active Supabase Auth
                session.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-black/8 bg-[#f6f8fc] p-5">
            <div className="flex items-start gap-3">
              <div className="icon-box h-10 w-10 bg-white">
                <OutlineIcon name="warning" className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold text-[#171a21]">
                  How to read this test
                </p>
                <p className="mt-2 text-sm leading-6 text-[#657187]">
                  A successful connection means the frontend Supabase client is
                  working. If profiles visible is 0 while logged out, that is
                  expected because RLS blocks private rows. If you are logged in
                  and still see unexpected results, check your profiles table
                  policy and auth session.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={runTest} className="btn btn-dark" type="button">
              <OutlineIcon name="refresh" className="mr-2 h-4 w-4" />
              Run test again
            </button>

            <Link href="/dashboard" className="btn btn-light">
              Back to dashboard
            </Link>
          </div>
        </section>
      </section>
    </AppShell>
  );
}