import { useEffect, useState } from "react";
import { Lock, Unlock, ShieldCheck, Eye, EyeOff, Plus, Trash2, Copy, ExternalLink, KeyRound, Vault, Settings, Save, LifeBuoy, Pencil, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ExtraRow = { id: string; key: string; value: string };
type VaultEntry = {
  id: string;
  heading: string;
  link: string;
  username: string;
  password: string;
  extras: ExtraRow[];
  createdAt: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export default function AdminVault() {
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 = locked, 1 = pin step, 2 = unlocked
  const [masterInput, setMasterInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showMaster, setShowMaster] = useState(false);

  // Vault config from DB
  const [cfg, setCfg] = useState<{ master_password: string; secret_pin: string; recovery_phone: string; recovery_dob: string } | null>(null);

  // Recovery modal
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recPhone, setRecPhone] = useState("");
  const [recDob, setRecDob] = useState("");
  const [recRevealed, setRecRevealed] = useState(false);

  // Settings panel (after unlock)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newMaster, setNewMaster] = useState("");
  const [newPin, setNewPin] = useState("");

  // Form state
  const [heading, setHeading] = useState("");
  const [link, setLink] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [extras, setExtras] = useState<ExtraRow[]>([]);

  // Vault data
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editHeading, setEditHeading] = useState("");
  const [editLink, setEditLink] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editShowPw, setEditShowPw] = useState(false);
  const [editExtras, setEditExtras] = useState<ExtraRow[]>([]);

  const loadCfg = async () => {
    const { data, error } = await supabase
      .from("vault_config" as any)
      .select("master_password, secret_pin, recovery_phone, recovery_dob")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to load vault config", description: error.message, variant: "destructive" });
      return;
    }
    if (data) {
      const row = data as any;
      setCfg({
        master_password: row.master_password ?? "",
        secret_pin: row.secret_pin ?? "",
        recovery_phone: row.recovery_phone ?? "",
        recovery_dob: row.recovery_dob ?? "",
      });
    }
  };

  useEffect(() => { loadCfg(); }, []);

  const fetchEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_vault_entries")
      .select("id, heading, link, username, password, extras, created_at")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "Failed to load vault", description: error.message, variant: "destructive" });
      return;
    }
    setEntries(
      (data || []).map((r: any) => ({
        id: r.id,
        heading: r.heading || "",
        link: r.link || "",
        username: r.username || "",
        password: r.password || "",
        extras: Array.isArray(r.extras) ? r.extras : [],
        createdAt: new Date(r.created_at).getTime(),
      }))
    );
  };

  useEffect(() => {
    if (stage === 2) fetchEntries();
  }, [stage]);

  const tryMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (cfg && masterInput === cfg.master_password) {
      setStage(1);
      setMasterInput("");
    } else {
      toast({ title: "Incorrect master password", variant: "destructive" });
    }
  };
  const tryPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (cfg && pinInput === cfg.secret_pin) {
      setStage(2);
      setPinInput("");
      // preload settings form
      setNewMaster(cfg.master_password);
      setNewPin(cfg.secret_pin);
    } else {
      toast({ title: "Incorrect secret PIN", variant: "destructive" });
    }
  };
  const lockVault = () => {
    setStage(0);
    setRevealed({});
    setEntries([]);
    setHeading("");
    setLink("");
    setUsername("");
    setPassword("");
    setExtras([]);
    setSettingsOpen(false);
    setRecoveryOpen(false);
    setRecRevealed(false);
    setRecPhone("");
    setRecDob("");
  };

  const tryRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg) return;
    const phoneOk = recPhone.trim() === (cfg.recovery_phone || "").trim();
    const dobOk = recDob.trim() === (cfg.recovery_dob || "").trim();
    if (phoneOk && dobOk) {
      setRecRevealed(true);
      toast({ title: "Identity verified" });
    } else {
      toast({ title: "Recovery details do not match", variant: "destructive" });
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaster.trim() || newPin.trim().length < 4) {
      toast({ title: "Master password and 4+ digit PIN required", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("vault_config" as any)
      .update({
        master_password: newMaster.trim(),
        secret_pin: newPin.trim(),
      })
      .eq("id", true);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vault security updated" });
    await loadCfg();
    setSettingsOpen(false);
  };

  const addExtra = () => setExtras((x) => [...x, { id: uid(), key: "", value: "" }]);
  const updateExtra = (id: string, patch: Partial<ExtraRow>) =>
    setExtras((x) => x.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeExtra = (id: string) => setExtras((x) => x.filter((r) => r.id !== id));

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!heading.trim()) {
      toast({ title: "Main heading is required", variant: "destructive" });
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    const cleanedExtras = extras.filter((r) => r.key.trim() || r.value.trim());
    const { error } = await supabase.from("admin_vault_entries").insert({
      heading: heading.trim(),
      link: link.trim() || null,
      username: username.trim() || null,
      password: password || null,
      extras: cleanedExtras,
      created_by: userRes.user?.id ?? null,
    });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    setHeading("");
    setLink("");
    setUsername("");
    setPassword("");
    setExtras([]);
    toast({ title: "Saved to vault" });
    fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    const { error } = await supabase.from("admin_vault_entries").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setEntries((arr) => arr.filter((e) => e.id !== id));
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  // ============== LOCKED SCREENS ==============
  if (stage !== 2) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(99,102,241,0.15),transparent_45%)] pointer-events-none" />
        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 backdrop-blur-xl shadow-2xl shadow-emerald-500/5 p-8">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-400/30 flex items-center justify-center mb-4">
                {stage === 0 ? <Lock className="h-7 w-7 text-emerald-400" /> : <KeyRound className="h-7 w-7 text-amber-400" />}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {stage === 0 ? "Secure Vault" : "Secret PIN"}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {stage === 0 ? "Enter master password to continue" : "Enter your 4-digit secret PIN"}
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs">
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${stage >= 0 ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" : "border-slate-700 text-slate-500"}`}>
                  <ShieldCheck className="h-3 w-3" /> Layer 1
                </span>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-full border ${stage >= 1 ? "border-amber-500/40 text-amber-300 bg-amber-500/10" : "border-slate-700 text-slate-500"}`}>
                  <ShieldCheck className="h-3 w-3" /> Layer 2
                </span>
              </div>
            </div>

            {stage === 0 ? (
              <form onSubmit={tryMaster} className="space-y-4">
                <div className="relative">
                  <input
                    type={showMaster ? "text" : "password"}
                    value={masterInput}
                    onChange={(e) => setMasterInput(e.target.value)}
                    placeholder="Master Password"
                    autoFocus
                    className="w-full h-12 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-4 pr-12 text-slate-100 placeholder:text-slate-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMaster((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showMaster ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-semibold transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Unlock className="h-4 w-4" /> Continue
                </button>
              </form>
            ) : (
              <form onSubmit={tryPin} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • •"
                  autoFocus
                  className="w-full h-14 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none px-4 text-center text-2xl tracking-[0.6em] text-slate-100 placeholder:text-slate-600 transition"
                />
                <button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Vault className="h-4 w-4" /> Unlock Vault
                </button>
                <button
                  type="button"
                  onClick={() => setStage(0)}
                  className="w-full text-xs text-slate-400 hover:text-slate-200"
                >
                  ← Back
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setRecoveryOpen(true); setRecRevealed(false); setRecPhone(""); setRecDob(""); }}
              className="mt-4 w-full text-xs text-slate-400 hover:text-emerald-300 inline-flex items-center justify-center gap-1.5"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> Forgot master password / PIN?
            </button>
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-600">
            Secure vault • Double security enabled
          </p>
        </div>

        {recoveryOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center px-4 overflow-y-auto py-8" onClick={() => setRecoveryOpen(false)}>
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-semibold">Account Recovery</h2>
              </div>
              {!recRevealed ? (
                <form onSubmit={tryRecovery} className="space-y-4">
                  <p className="text-xs text-slate-400">Confirm your recovery details to view the master password and PIN.</p>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Recovery Phone Number</label>
                    <input
                      value={recPhone}
                      onChange={(e) => setRecPhone(e.target.value)}
                      placeholder="Enter recovery phone"
                      inputMode="numeric"
                      className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none px-3 text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Son's Date of Birth</label>
                    <input
                      value={recDob}
                      onChange={(e) => setRecDob(e.target.value)}
                      placeholder="DD-MM-YYYY"
                      className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none px-3 text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => setRecoveryOpen(false)} className="flex-1 h-11 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm text-slate-300">Cancel</button>
                    <button type="submit" className="flex-1 h-11 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-sm">Verify</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg bg-slate-950/60 border border-emerald-500/30 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase text-emerald-400 font-bold">Master Password</div>
                        <div className="font-mono text-emerald-100 text-base break-all">{cfg?.master_password}</div>
                      </div>
                      <button type="button" onClick={() => copy(cfg?.master_password || "", "Master Password")} className="text-slate-400 hover:text-emerald-300"><Copy className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase text-amber-400 font-bold">Secret PIN</div>
                        <div className="font-mono text-amber-100 text-base tracking-[0.3em]">{cfg?.secret_pin}</div>
                      </div>
                      <button type="button" onClick={() => copy(cfg?.secret_pin || "", "PIN")} className="text-slate-400 hover:text-amber-300"><Copy className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setRecoveryOpen(false); setRecRevealed(false); }} className="w-full h-11 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-200">Close</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============== MAIN VAULT ==============
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-400/30 flex items-center justify-center">
              <Vault className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Credentials Vault</h1>
              <p className="text-xs text-slate-500">{entries.length} saved {entries.length === 1 ? "record" : "records"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition text-sm font-medium"
            >
              <Settings className="h-4 w-4" /> Security
            </button>
            <button
              onClick={lockVault}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition text-sm font-medium"
            >
              <Lock className="h-4 w-4" /> Lock Vault
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-8">
        {/* === FORM === */}
        <section className="lg:sticky lg:top-24 lg:self-start">
          <form onSubmit={saveEntry} className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-5">
              <Plus className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">New Entry</h2>
            </div>

            <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">
              Main Heading / Account Name
            </label>
            <input
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              placeholder="e.g. HDFC Bank, Google Suite"
              className="w-full h-12 rounded-xl bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-4 text-base font-medium text-slate-100 placeholder:text-slate-600 transition mb-5"
            />

            <div className="space-y-3">
              <Field label="Website / Bank Link" value={link} onChange={setLink} placeholder="https://..." />
              <Field label="Username / Email" value={username} onChange={setUsername} placeholder="user@example.com" />
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-3 pr-10 text-slate-100 placeholder:text-slate-600 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Extras */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Custom Fields</h3>
                <button
                  type="button"
                  onClick={addExtra}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Column
                </button>
              </div>

              {extras.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No custom fields. Click "Add Column" to add Sub-Heading + Value pairs.</p>
              ) : (
                <div className="space-y-2">
                  {extras.map((row) => (
                    <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <input
                        value={row.key}
                        onChange={(e) => updateExtra(row.id, { key: e.target.value })}
                        placeholder="Sub-Heading"
                        className="h-10 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none px-3 text-sm text-amber-200 placeholder:text-slate-600 transition"
                      />
                      <input
                        value={row.value}
                        onChange={(e) => updateExtra(row.id, { value: e.target.value })}
                        placeholder="Value"
                        className="h-10 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-3 text-sm text-slate-100 placeholder:text-slate-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => removeExtra(row.id)}
                        className="h-10 w-10 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mt-6 w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 font-semibold transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="h-4 w-4" /> Save to Vault
            </button>
          </form>
        </section>

        {/* === LIST === */}
        <section>
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
              <Vault className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Your vault is empty. Add your first credential to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {entries.map((entry) => {
                const isOpen = !!revealed[entry.id];
                return (
                  <article
                    key={entry.id}
                    className="group rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur p-5 shadow-xl hover:border-emerald-500/30 hover:shadow-emerald-500/5 transition"
                  >
                    <header className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-slate-800">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold tracking-tight text-slate-100 truncate">
                          {entry.heading}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        className="shrink-0 h-9 w-9 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </header>

                    <div className="space-y-2.5">
                      {entry.link && (
                        <Row label="Link" value={entry.link} onCopy={() => copy(entry.link, "Link")}
                          rightIcon={
                            <a href={entry.link.startsWith("http") ? entry.link : `https://${entry.link}`} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-emerald-300">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          }
                        />
                      )}
                      {entry.username && <Row label="Username" value={entry.username} onCopy={() => copy(entry.username, "Username")} />}
                      {entry.password && (
                        <Row
                          label="Password"
                          value={isOpen ? entry.password : "•".repeat(Math.min(entry.password.length, 12))}
                          mono
                          onCopy={() => copy(entry.password, "Password")}
                          rightIcon={
                            <button onClick={() => setRevealed((r) => ({ ...r, [entry.id]: !r[entry.id] }))} className="text-slate-400 hover:text-emerald-300">
                              {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          }
                        />
                      )}
                    </div>

                    {entry.extras.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                        {entry.extras.map((r) => (
                          <div key={r.id} className="flex flex-col gap-0.5">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                              {r.key}
                            </span>
                            <div className="flex items-center justify-between gap-2 group/row">
                              <span className="text-sm text-slate-200 break-all">{r.value}</span>
                              <button onClick={() => copy(r.value, r.key)} className="shrink-0 text-slate-500 hover:text-emerald-300 opacity-0 group-hover/row:opacity-100 transition">
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center px-4 overflow-y-auto py-8" onClick={() => setSettingsOpen(false)}>
          <form onSubmit={saveSettings} className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">Vault Security Settings</h2>
            </div>

            <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Current Credentials</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase text-emerald-400 font-bold">Master Password</div>
                  <div className="font-mono text-emerald-100 text-base break-all">{cfg?.master_password}</div>
                </div>
                <button type="button" onClick={() => copy(cfg?.master_password || "", "Master Password")} className="text-slate-400 hover:text-emerald-300"><Copy className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div>
                  <div className="text-[10px] uppercase text-amber-400 font-bold">Secret PIN</div>
                  <div className="font-mono text-amber-100 text-base tracking-[0.3em]">{cfg?.secret_pin}</div>
                </div>
                <button type="button" onClick={() => copy(cfg?.secret_pin || "", "PIN")} className="text-slate-400 hover:text-amber-300"><Copy className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">New Master Password</label>
                <input value={newMaster} onChange={(e) => setNewMaster(e.target.value)} className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-3 text-slate-100" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">New Secret PIN (4+ digits)</label>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} maxLength={8} className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 outline-none px-3 text-slate-100 font-mono tracking-[0.3em]" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setSettingsOpen(false)} className="flex-1 h-11 rounded-lg border border-slate-700 hover:bg-slate-800 text-sm text-slate-300">Cancel</button>
              <button type="submit" className="flex-1 h-11 rounded-lg bg-gradient-to-r from-emerald-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2"><Save className="h-4 w-4" /> Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 rounded-lg bg-slate-950/60 border border-slate-700 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/20 outline-none px-3 text-slate-100 placeholder:text-slate-600 transition"
      />
    </div>
  );
}

function Row({ label, value, onCopy, rightIcon, mono }: { label: string; value: string; onCopy?: () => void; rightIcon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="group/row flex items-center justify-between gap-2 bg-slate-950/40 border border-slate-800/60 rounded-lg px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</div>
        <div className={`text-sm text-slate-100 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onCopy && (
          <button onClick={onCopy} className="text-slate-400 hover:text-emerald-300 opacity-0 group-hover/row:opacity-100 transition">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {rightIcon}
      </div>
    </div>
  );
}
