"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Download, Filter, History, MapPin, Phone, RotateCcw, Search, Trash2, User, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { budgetRange, csvCell, fmtTime, pkr } from "@/lib/format";
import { PROPERTY_TYPES, STATUSES, type AuditLog, type Lead, type Profile, type Status } from "@/lib/types";
import { focusRing, inputCls, Modal } from "./ui";
import Consultants from "./Consultants";

const STATUS_STYLE: Record<Status, string> = {
  New: "bg-sky-50 text-sky-700 ring-sky-200",
  Contacted: "bg-amber-50 text-amber-700 ring-amber-200",
  "In Progress": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Closed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Archived: "bg-slate-100 text-slate-600 ring-slate-300",
};

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof User }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="rounded-lg bg-indigo-50 p-2.5 text-indigo-600"><Icon size={20} /></div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="truncate text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard({ flash }: { flash: (m: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [q, setQ] = useState("");
  const [prop, setProp] = useState("All");
  const [cons, setCons] = useState("All");
  const [trans, setTrans] = useState("All");
  const [showDeleted, setShowDeleted] = useState(false);
  const [auditFor, setAuditFor] = useState<Lead | null>(null);
  const [audit, setAudit] = useState<AuditLog[] | null>(null);
  const [showPeople, setShowPeople] = useState(false);

  const load = useCallback(async () => {
    const [l, p] = await Promise.all([
      supabase.from("leads").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name"),
    ]);
    if (l.error || p.error) { setLoadError(true); setLoaded(true); return; }
    setLoadError(false);
    setLeads((l.data ?? []) as Lead[]);
    setPeople((p.data ?? []) as Profile[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Live updates: refresh whenever any lead changes.
    const ch = supabase.channel("leads-changes").on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const nameOf = useCallback((id: string) => people.find((p) => p.id === id)?.full_name || people.find((p) => p.id === id)?.email || "Unknown", [people]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) =>
      (showDeleted ? !!l.deleted_at : !l.deleted_at) &&
      (prop === "All" || l.property_type === prop) &&
      (cons === "All" || l.consultant_id === cons) &&
      (trans === "All" || l.transaction_type === trans) &&
      (!s || l.client_name.toLowerCase().includes(s) || l.notes.toLowerCase().includes(s) || l.preferred_locations.some((x) => x.toLowerCase().includes(s))));
  }, [leads, q, prop, cons, trans, showDeleted]);

  const live = leads.filter((l) => !l.deleted_at);
  const open = live.filter((l) => l.status !== "Closed" && l.status !== "Archived");
  const stats = {
    total: live.length,
    rentals: open.filter((l) => l.transaction_type === "Rent").length,
    sales: open.filter((l) => l.transaction_type === "Sale").length,
    volume: open.reduce((a, l) => a + Number(l.budget_max), 0),
  };

  const setStatus = async (l: Lead, status: Status) => {
    if (status === l.status) return;
    const prev = leads;
    setLeads((ls) => ls.map((x) => (x.id === l.id ? { ...x, status } : x))); // optimistic
    const { error } = await supabase.from("leads").update({ status }).eq("id", l.id);
    if (error) { setLeads(prev); flash("Could not update the status. Try again."); } else flash(`Status updated to ${status}`);
  };

  const setDeleted = async (l: Lead, deleted: boolean) => {
    const { error } = await supabase.from("leads").update({ deleted_at: deleted ? new Date().toISOString() : null }).eq("id", l.id);
    if (error) flash("Could not update this lead. Try again.");
    else { flash(deleted ? "Lead moved to Deleted" : "Lead restored"); load(); }
  };

  const openAudit = async (l: Lead) => {
    setAuditFor(l); setAudit(null);
    const { data } = await supabase.from("audit_logs").select("*").eq("lead_id", l.id).order("changed_at", { ascending: false });
    setAudit((data ?? []) as AuditLog[]);
  };

  const exportCsv = () => {
    const head = ["Client", "Consultant", "Transaction", "Requirement", "Property", "Budget Min (PKR)", "Budget Max (PKR)", "Phones", "Locations", "Custom Attributes", "Status", "Notes", "Created"];
    const rows = visible.map((l) => [l.client_name, l.consultant_name || nameOf(l.consultant_id), l.transaction_type, l.requirement_type, l.property_type, l.budget_min, l.budget_max,
      l.contact_numbers.join(" | "), l.preferred_locations.join(" | "), Object.entries(l.custom_attributes).map(([k, v]) => `${k}=${v}`).join(" | "), l.status, l.notes, l.created_at]);
    const text = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const consultants = people.filter((p) => p.role === "staff" || leads.some((l) => l.consultant_id === p.id));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Admin control center</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPeople(true)} className={`inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 ${focusRing}`}>
            <Users size={16} /> Consultants ({people.filter((p) => p.role === "staff").length})
          </button>
          <button onClick={exportCsv} className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 ${focusRing}`}>
            <Download size={16} /> Export CSV ({visible.length})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total leads" value={stats.total} icon={User} />
        <StatCard label="Active rentals" value={stats.rentals} icon={Building2} />
        <StatCard label="Active sales" value={stats.sales} icon={Building2} />
        <StatCard label="Open volume (max budget)" value={pkr(stats.volume)} icon={Download} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500"><Filter size={16} /> Filters</div>
        <div className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="search" aria-label="Search" className={`${inputCls} pl-9`} placeholder="Search client, notes or location…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Property" className={`${inputCls} lg:w-auto`} value={prop} onChange={(e) => setProp(e.target.value)}>
          <option value="All">Property: All</option>{PROPERTY_TYPES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select aria-label="Consultant" className={`${inputCls} lg:w-auto`} value={cons} onChange={(e) => setCons(e.target.value)}>
          <option value="All">Consultant: All</option>{consultants.map((p) => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
        </select>
        <select aria-label="Transaction" className={`${inputCls} lg:w-auto`} value={trans} onChange={(e) => setTrans(e.target.value)}>
          <option value="All">Transaction: All</option><option>Rent</option><option>Sale</option>
        </select>
        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> Show deleted
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>{["Client", "Consultant", "Type", "Budget (PKR)", "Contacts", "Locations", "Custom attributes", "Status", ""].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((l) => (
                <tr key={l.id} className={`align-top transition hover:bg-slate-50 ${l.deleted_at ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{l.client_name}</p>{l.notes && <p className="mt-0.5 max-w-[14rem] truncate text-xs text-slate-500" title={l.notes}>{l.notes}</p>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{l.consultant_name || nameOf(l.consultant_id)}</td>
                  <td className="whitespace-nowrap px-4 py-3"><p className="text-slate-800">{l.property_type}</p><p className="text-xs text-slate-500">{l.transaction_type} · {l.requirement_type}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-800">{budgetRange(Number(l.budget_min), Number(l.budget_max))}</td>
                  <td className="px-4 py-3"><div className="space-y-0.5">{l.contact_numbers.map((p) => <p key={p} className="flex items-center gap-1.5 whitespace-nowrap text-xs tabular-nums text-slate-600"><Phone size={11} />{p}</p>)}</div></td>
                  <td className="px-4 py-3"><div className="flex max-w-[12rem] flex-wrap gap-1">{l.preferred_locations.length ? l.preferred_locations.map((x) => <span key={x} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"><MapPin size={10} />{x}</span>) : <span className="text-slate-400">—</span>}</div></td>
                  <td className="px-4 py-3"><div className="flex max-w-[13rem] flex-wrap gap-1">{Object.keys(l.custom_attributes).length ? Object.entries(l.custom_attributes).map(([k, v]) => <span key={k} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 ring-1 ring-inset ring-indigo-200"><b>{k}:</b> {v}</span>) : <span className="text-slate-400">—</span>}</div></td>
                  <td className="px-4 py-3">
                    <select aria-label={`Status for ${l.client_name}`} value={l.status} disabled={!!l.deleted_at} onChange={(e) => setStatus(l, e.target.value as Status)}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[l.status]} ${focusRing}`}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button onClick={() => openAudit(l)} className={`mr-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 ${focusRing}`}>
                      <History size={13} /> Audit
                    </button>
                    {l.deleted_at ? (
                      <button onClick={() => setDeleted(l, false)} aria-label="Restore lead" className={`rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 ${focusRing}`}><RotateCcw size={14} /></button>
                    ) : (
                      <button onClick={() => setDeleted(l, true)} aria-label="Delete lead" className={`rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 ${focusRing}`}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                  {loadError ? "Could not load leads. Check your connection and that the database setup was run." : !loaded ? "Loading leads…" : leads.length ? "No leads match these filters." : "No leads yet. They appear here as soon as a consultant saves the intake form."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">Showing {visible.length} of {leads.length} leads. Change a status from its dropdown; every change is written to the audit log.</p>
      </div>

      {auditFor && (
        <Modal title={`Audit log · ${auditFor.client_name}`} onClose={() => setAuditFor(null)}>
          {audit === null ? <p className="text-sm text-slate-500">Loading…</p> : !audit.length ? <p className="text-sm text-slate-500">No changes recorded.</p> : (
            <ol className="space-y-4 border-l-2 border-slate-200 pl-5">
              {audit.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-200" />
                  <p className="text-sm text-slate-800">
                    {a.field === "created" ? <b>Lead created</b> : <><b>{a.field.replace(/_/g, " ")}</b> changed from <s className="text-slate-500">{a.old_value ?? "—"}</s> to <b>{a.new_value ?? "—"}</b></>}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500">{a.changed_by ? nameOf(a.changed_by) : "System"} · {fmtTime(a.changed_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      {showPeople && <Consultants people={people} onClose={() => setShowPeople(false)} onChanged={load} flash={flash} />}
    </div>
  );
}
