"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestSupabasePage() {
  const [status, setStatus] = useState("Testing Supabase connection...");
  const [profilesCount, setProfilesCount] = useState<number | null>(null);

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from("profiles").select("id");

      if (error) {
        setStatus(`Supabase error: ${error.message}`);
        return;
      }

      setProfilesCount(data?.length ?? 0);
      setStatus("Supabase connection successful.");
    }

    testConnection();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-bold mb-4">MailMotive Supabase Test</h1>

        <p className="text-slate-300 mb-4">{status}</p>

        {profilesCount !== null && (
          <p className="text-emerald-400">
            Profiles visible to current session: {profilesCount}
          </p>
        )}

        <p className="text-sm text-slate-500 mt-6">
          If you are not logged in, seeing 0 profiles is normal because RLS protects the table.
        </p>
      </div>
    </main>
  );
}