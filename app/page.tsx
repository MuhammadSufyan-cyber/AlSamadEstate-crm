"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Building2, CheckCircle2, ClipboardPen, LogOut } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import Login from "@/components/Login";
import IntakeForm from "@/components/IntakeForm";
import AdminDashboard from "@/components/AdminDashboard";
import { focusRing } from "@/components/ui";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [tab, setTab] = useState<"form" | "admin">("form");
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = useCallback((m: string) => {
    setToast(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setProfile((p) => (p && s && p.id === s.user.id ? p : null));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    supabase.from("profiles").select("*").eq("id", userId).single().then(({ data, error }) => {
      if (!live) return;
      if (error || !data) { setProfileError(true); return; }
      setProfileError(false);
      setProfile(data as Profile);
      setTab((data as Profile).role === "admin" ? "admin" : "form");
    });
    return () => { live = false; };
  }, [userId]);

  if (!supabaseConfigured) {
    return <main className="p-8 text-sm text-slate-700">Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and fill in the project URL and anon key.</main>;
  }

  const isAdmin = profile?.role === "admin";

  return (
    <main className="mx-auto w-full max-w-[88rem] px-4 py-4 pb-10 sm:px-6">
      {!ready ? null : !session ? (
        <Login />
      ) : profileError ? (
        <div className="mx-auto mt-16 max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
          <p>Your account is signed in, but its profile was not found. Ask the admin to check your account.</p>
          <button onClick={() => supabase.auth.signOut()} className={`rounded-lg border border-slate-300 px-3 py-2 font-medium ${focusRing}`}>Sign out</button>
        </div>
      ) : !profile ? null : !profile.is_active ? (
        <div className="mx-auto mt-16 max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
          <p>This account is turned off. Contact the admin.</p>
          <button onClick={() => supabase.auth.signOut()} className={`rounded-lg border border-slate-300 px-3 py-2 font-medium ${focusRing}`}>Sign out</button>
        </div>
      ) : (
        <>
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-indigo-600 p-2 text-white"><Building2 size={20} /></div>
              <div>
                <p className="text-base font-semibold leading-tight text-slate-900">Al Samad Estate</p>
                <p className="text-xs text-slate-500">{profile.full_name || "Signed in"}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <nav role="tablist" className="flex rounded-xl bg-slate-200/70 p-1">
                  {([["form", "Consultant Form", ClipboardPen], ["admin", "Admin Dashboard", Building2]] as const).map(([k, l, Icon]) => (
                    <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${focusRing} ${tab === k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                      <Icon size={15} />{l}
                    </button>
                  ))}
                </nav>
              )}
              <button onClick={() => supabase.auth.signOut()} className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </header>

          {isAdmin && tab === "admin" ? <AdminDashboard flash={flash} /> : <IntakeForm profile={profile} onSaved={flash} />}
        </>
      )}

      {toast && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[60] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          <CheckCircle2 size={18} className="text-emerald-400" />{toast}
        </div>
      )}
    </main>
  );
}
