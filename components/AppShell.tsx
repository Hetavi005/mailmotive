"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { IconName, OutlineIcon } from "@/components/OutlineIcon";

type ActivePage =
  | "dashboard"
  | "outreach"
  | "emails"
  | "followups"
  | "contacts"
  | "files"
  | "test";

type AppShellProps = {
  activePage: ActivePage;
  children: ReactNode;
  email?: string | null;
};

type NavItem = {
  label: string;
  href: string;
  icon: IconName;
  active: ActivePage;
};

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: "dashboard",
    active: "dashboard",
  },
  {
    label: "New Outreach",
    href: "/outreach/new",
    icon: "compose",
    active: "outreach",
  },
  {
    label: "Emails",
    href: "/emails",
    icon: "mail",
    active: "emails",
  },
  {
    label: "Follow-ups",
    href: "/followups",
    icon: "repeat",
    active: "followups",
  },
  {
    label: "Contacts",
    href: "/professors",
    icon: "people",
    active: "contacts",
  },
  {
    label: "Files",
    href: "/resumes",
    icon: "file",
    active: "files",
  },
];

export default function AppShell({
  activePage,
  children,
  email,
}: AppShellProps) {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState<string | null>(email ?? null);

  useEffect(() => {
    if (email) {
      setCurrentEmail(email);
      return;
    }

    async function loadEmail() {
      const { data } = await supabase.auth.getSession();
      setCurrentEmail(data.session?.user.email ?? null);
    }

    loadEmail();
  }, [email]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="app-shell">
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#9BFFC7] text-black">
                <OutlineIcon name="dashboard" />
              </div>

              <div>
                <p className="text-sm font-semibold tracking-wide">MailMotive</p>
                <p className="text-xs text-white/45">Automation portal</p>
              </div>
            </div>

            <nav className="mt-10 space-y-2">
              {navItems.map((item) => {
                const isActive = activePage === item.active;

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                      isActive
                        ? "bg-white text-black"
                        : "text-white/62 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <OutlineIcon name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-auto rounded-3xl border border-white/10 bg-white/6 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
              Signed in
            </p>

            <p className="mt-2 break-all text-sm text-white/78">
              {currentEmail ?? "Loading..."}
            </p>

            <button
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white hover:text-black"
              type="button"
            >
              <OutlineIcon name="logout" className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <section className="dashboard-main">
          <div className="dashboard-content">{children}</div>
        </section>
      </div>
    </main>
  );
}