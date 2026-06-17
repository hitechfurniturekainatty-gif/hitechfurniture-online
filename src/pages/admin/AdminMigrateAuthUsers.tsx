import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { AdminOnly } from "@/components/admin/AdminOnly";

const ENDPOINT = "https://thwleiywbpyccgtacczv.supabase.co/functions/v1/migrate-auth-users";

function AdminMigrateAuthUsersInner() {
  const [file, setFile] = useState<File | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    setError(null);
    setResult(null);
    if (!file) { setError("Pick a CSV file first."); return; }
    if (!token.trim()) { setError("Paste the migration token (the new project's service-role key)."); return; }
    setLoading(true);
    try {
      const csv = await file.text();
      const r = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-migration-token": token.trim(),
        },
        body: JSON.stringify({ csv }),
      });
      const text = await r.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      if (!r.ok) {
        setError(`HTTP ${r.status}: ${parsed?.error ?? text.slice(0, 300)}`);
      } else {
        setResult(parsed);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Migrate auth users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload the <code>auth.users</code> CSV exported from the old project.
          Existing users are skipped, so this is safe to re-run.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Import</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv">Users CSV file</Label>
            <Input
              id="csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} — {(file.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">Migration token</Label>
            <Input
              id="token"
              type="password"
              placeholder="Paste the new project's service-role key"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Sent as <code>x-migration-token</code>. Never stored.
            </p>
          </div>

          <Button onClick={onRun} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Importing…" : "Import users"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">Error</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{error}</pre>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3 text-center">
              <Stat label="Total" value={result.total} />
              <Stat label="Created" value={result.created} tone="success" />
              <Stat label="Skipped" value={result.skipped} tone="muted" />
              <Stat label="Failed" value={result.failed} tone={result.failed ? "danger" : "muted"} />
            </div>
            <details>
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Per-row details
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
                {JSON.stringify(result.results ?? result, null, 2)}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" | "muted" }) {
  const color =
    tone === "success" ? "text-emerald-600" :
    tone === "danger"  ? "text-destructive" :
    tone === "muted"   ? "text-muted-foreground" :
    "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className={`text-2xl font-semibold ${color}`}>{value ?? 0}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

export default function AdminMigrateAuthUsers() {
  return (
    <AdminOnly>
      <AdminMigrateAuthUsersInner />
    </AdminOnly>
  );
}