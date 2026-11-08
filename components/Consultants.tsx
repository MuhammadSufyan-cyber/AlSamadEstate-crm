"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { Field, focusRing, inputCls, Modal } from "./ui";

export default function Consultants({ people, onClose, onChanged, flash }: { people: Profile[]; onClose: () => void; onChanged: () => void; flash: (m: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || password.length < 8) return setError("Enter a name, an email and a password of at least 8 characters.");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: JSON.stringify({ full_name: name.trim(), email: email.trim(), password }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error || "Could not create the account.");
    setName(""); setEmail(""); setPassword("");
    flash(`Account created for ${body.full_name}. Give them their email and password.`);
    onChanged();
  };

  const toggle = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) flash("Could not update this account."); else { flash(p.is_active ? "Account turned off" : "Account turned on"); onChanged(); }
  };

  return (
    <Modal title="Consultants" wide onClose={onClose}>
      <form onSubmit={add} className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
        <p className="text-sm font-medium text-slate-700">Add a consultant</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Full name"><input id="newName" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email (their login)"><input id="newEmail" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input id="newPassword" type="text" autoComplete="off" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        <button disabled={busy} className={`inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 ${focusRing}`}>
          <Plus size={16} /> {busy ? "Creating…" : "Create account"}
        </button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{p.full_name || "(no name)"} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">{p.role}</span></p>
              <p className="truncate text-xs text-slate-500">{p.email}</p>
            </div>
            {p.role === "staff" && (
              <button onClick={() => toggle(p)} className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${focusRing} ${p.is_active ? "border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-600" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
                {p.is_active ? "Turn off" : "Turn on"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Turning an account off stops that person from saving or viewing leads. Their past leads stay.</p>
    </Modal>
  );
}
