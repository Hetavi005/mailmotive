"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

        setMessage("Account created. Now click Login and sign in.");
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
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-2">MailMotive</h1>
        <p className="text-slate-400 mb-8">
          HiWi professor outreach and email scheduling portal.
        </p>

        <div className="flex rounded-xl bg-slate-800 p-1 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === "login" ? "bg-white text-slate-950" : "text-slate-300"
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
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === "signup" ? "bg-white text-slate-950" : "text-slate-300"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm text-slate-300 mb-1">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-400"
                placeholder="Hetavi Patel"
              />
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-300 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-400"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-400"
              placeholder="Minimum 6 characters"
            />
          </div>

          {message && (
            <p className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Create account"}
          </button>
        </form>
      </div>
    </main>
  );
}