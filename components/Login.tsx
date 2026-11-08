"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Field, focusRing, inputCls } from "./ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError("Wrong email or password. Check them and try again.");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-16 w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-indigo-600 p-2 text-white">
          <Building2 size={20} />
        </div>
        <div>
          <p className="font-semibold leading-tight text-slate-900">Al Samad Estate</p>
          <p className="text-xs text-slate-500">Lead management</p>
        </div>
      </div>
      <Field label="Email">
        <input id="email" type="email" autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      </Field>
      <Field label="Password" error={error}>
        <input id="password" type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button
        type="submit"
        disabled={busy || !email.trim() || !password}
        className={`w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60 ${focusRing}`}
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
