"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { compact, PHONE_RE } from "@/lib/format";
import { PROPERTY_TYPES, REQ_TYPES, type Profile } from "@/lib/types";
import { Chip, Field, focusRing, inputCls } from "./ui";

const empty = () => ({
  clientName: "", transaction: "Rent", requirement: "Renting", propertyType: "Apartment",
  phones: [""], min: "", max: "", locations: [] as string[], locInput: "", notes: "",
  custom: {} as Record<string, string>, ck: "", cv: "",
});

const numFmt = (v: string) => {
  const d = v.replace(/[^0-9]/g, "");
  return d ? Number(d).toLocaleString("en-US") : "";
};
const toNum = (v: string) => Number(v.replace(/,/g, "")) || 0;

function Segmented({ options, value, onChange, label }: { options: readonly string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${focusRing} ${
            value === o ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export default function IntakeForm({ profile, onSaved }: { profile: Profile; onSaved: (msg: string) => void }) {
  const [f, setF] = useState(empty());
  const [consultantName, setConsultantName] = useState(profile.full_name || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ReturnType<typeof empty>>) => setF((p) => ({ ...p, ...patch }));

  const addLocation = () => {
    const v = f.locInput.trim().replace(/,$/, "");
    if (v && !f.locations.some((l) => l.toLowerCase() === v.toLowerCase())) set({ locations: [...f.locations, v], locInput: "" });
    else set({ locInput: "" });
  };
  const addCustom = () => {
    const k = f.ck.trim(), v = f.cv.trim();
    if (!k || !v) return setErrors((e) => ({ ...e, custom: "Enter both a key and a value." }));
    setErrors((e) => ({ ...e, custom: "" }));
    set({ custom: { ...f.custom, [k]: v }, ck: "", cv: "" });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!consultantName.trim()) e.consultant = "Enter your name.";
    if (!f.clientName.trim()) e.clientName = "Client name is required.";
    const phones = f.phones.map((p) => p.trim());
    if (!phones[0]) e.phone0 = "At least one phone number is required.";
    phones.forEach((p, i) => { if (p && !PHONE_RE.test(p)) e["phone" + i] = "Use 7–16 digits, e.g. +92 300 1234567."; });
    if (f.min && f.max && toNum(f.max) < toNum(f.min)) e.budget = "Maximum budget must be at least the minimum.";
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    // A location typed but not yet confirmed with Enter still counts.
    const pending = f.locInput.trim().replace(/,$/, "");
    const locations = pending && !f.locations.some((l) => l.toLowerCase() === pending.toLowerCase()) ? [...f.locations, pending] : f.locations;
    const { error } = await supabase.from("leads").insert({
      consultant_id: profile.id,
      consultant_name: consultantName.trim(),
      client_name: f.clientName.trim(),
      transaction_type: f.transaction,
      requirement_type: f.requirement,
      property_type: f.propertyType,
      contact_numbers: f.phones.map((p) => p.trim()).filter(Boolean),
      preferred_locations: locations,
      budget_min: toNum(f.min),
      budget_max: toNum(f.max),
      notes: f.notes.trim(),
      custom_attributes: f.custom,
    });
    setSaving(false);
    if (error) return setErrors({ submit: "Could not save. Check your connection and try again." });
    onSaved(`Saved. ${f.clientName.trim()} is now visible to the admin.`);
    setF(empty());
  };

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Consultant intake form</h2>
        <p className="mt-1 text-sm text-slate-500">Capture a client&apos;s requirement. Fields marked * are required.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Consultant name" required error={errors.consultant}>
          <input id="consultant" className={inputCls} placeholder="Your full name" value={consultantName} onChange={(e) => setConsultantName(e.target.value)} />
        </Field>
        <Field label="Client name" required error={errors.clientName}>
          <input id="clientName" className={inputCls} placeholder="e.g. Ahmed Raza" value={f.clientName} onChange={(e) => set({ clientName: e.target.value })} />
        </Field>
      </div>

      <Field label="Transaction type"><Segmented label="Transaction type" options={["Rent", "Sale"]} value={f.transaction} onChange={(v) => set({ transaction: v })} /></Field>

      <Field label="Requirement type">
        <select id="requirement" className={inputCls} value={f.requirement} onChange={(e) => set({ requirement: e.target.value })}>
          {REQ_TYPES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </Field>

      <Field label="Property type"><Segmented label="Property type" options={PROPERTY_TYPES} value={f.propertyType} onChange={(v) => set({ propertyType: v })} /></Field>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">Contact numbers <span className="text-rose-500">*</span></label>
        {f.phones.map((p, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id={`phone${i}`} inputMode="tel" className={`${inputCls} pl-9`} placeholder={`Phone ${i + 1}`} value={p}
                  onChange={(e) => set({ phones: f.phones.map((x, j) => (j === i ? e.target.value : x)) })} />
              </div>
              {i > 0 && (
                <button type="button" aria-label={`Remove phone ${i + 1}`} onClick={() => set({ phones: f.phones.filter((_, j) => j !== i) })}
                  className={`rounded-lg border border-slate-300 p-2.5 text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 ${focusRing}`}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {errors["phone" + i] && <p className="flex items-center gap-1 text-xs text-rose-600"><AlertTriangle size={12} />{errors["phone" + i]}</p>}
          </div>
        ))}
        {f.phones.length < 3 && (
          <button type="button" onClick={() => set({ phones: [...f.phones, ""] })}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 ${focusRing}`}>
            <Plus size={16} /> Add phone
          </button>
        )}
      </div>

      <Field label="Budget range (PKR)" error={errors.budget}>
        <div className="grid grid-cols-2 gap-3">
          {(["min", "max"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-500">PKR</span>
                <input id={`budget-${k}`} inputMode="numeric" aria-label={`${k === "min" ? "Minimum" : "Maximum"} budget`} className={`${inputCls} pl-14 tabular-nums`}
                  placeholder={k === "min" ? "Minimum" : "Maximum"} value={f[k]} onChange={(e) => set({ [k]: numFmt(e.target.value) })} />
              </div>
              {toNum(f[k]) > 0 && <p className="text-xs tabular-nums text-slate-500">= {compact(toNum(f[k]))}</p>}
            </div>
          ))}
        </div>
      </Field>

      <Field label="Preferred locations" hint="Type a location and press Enter to add it as a tag.">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 bg-white p-2 transition focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-200">
          {f.locations.map((l) => <Chip key={l} onRemove={() => set({ locations: f.locations.filter((x) => x !== l) })}>{l}</Chip>)}
          <input id="locInput" className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400" placeholder="DHA, Bahria Town…"
            value={f.locInput} onChange={(e) => set({ locInput: e.target.value })} onBlur={addLocation}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addLocation(); }
              else if (e.key === "Backspace" && !f.locInput && f.locations.length) set({ locations: f.locations.slice(0, -1) });
            }} />
        </div>
      </Field>

      <Field label="Description / notes">
        <textarea id="notes" rows={3} className={`${inputCls} resize-y`} placeholder="Anything specific the client mentioned…" value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Field>

      <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
        <div>
          <p className="text-sm font-medium text-slate-700">Add other options</p>
          <p className="text-xs text-slate-500">Anything not covered above, such as Parking Slots: 2 or Furnished: Yes.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="customKey" aria-label="Field key" className={inputCls} placeholder="Key, e.g. Parking Slots" value={f.ck} onChange={(e) => set({ ck: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <input id="customValue" aria-label="Field value" className={inputCls} placeholder="Value, e.g. 2" value={f.cv} onChange={(e) => set({ cv: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
          <button type="button" onClick={addCustom}
            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 ${focusRing}`}>
            <Plus size={16} /> Add field
          </button>
        </div>
        {errors.custom && <p className="text-xs text-rose-600">{errors.custom}</p>}
        {Object.keys(f.custom).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(f.custom).map(([k, v]) => (
              <Chip key={k} onRemove={() => { const { [k]: _omit, ...rest } = f.custom; void _omit; set({ custom: rest }); }}><b>{k}:</b> {v}</Chip>
            ))}
          </div>
        )}
      </div>

      {errors.submit && <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle size={14} />{errors.submit}</p>}
      <button type="submit" disabled={saving}
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70 ${focusRing}`}>
        <CheckCircle2 size={16} /> {saving ? "Saving…" : "Save & sync to database"}
      </button>
    </form>
  );
}
