import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CHAPTERS,
  GUIDE_LAST_UPDATED,
  APP_VERSION,
  GuideRole,
  filterChaptersForRole,
} from "@/lib/guideContent";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, BookOpen, Printer } from "lucide-react";

const ROLE_OPTIONS: { value: GuideRole; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "admin", label: "Admin" },
  { value: "office", label: "Office" },
  { value: "measurement", label: "Measurement" },
  { value: "worker", label: "Worker" },
  { value: "delivery", label: "Delivery" },
  { value: "customer", label: "Customer" },
];

const UserGuide = () => {
  const { isAdmin, isOfficeStaff, isMeasurementStaff, isWorker, isDelivery } = useAuth();
  const initialRole: GuideRole = isAdmin
    ? "admin"
    : isOfficeStaff
    ? "office"
    : isMeasurementStaff
    ? "measurement"
    : isWorker
    ? "worker"
    : isDelivery
    ? "delivery"
    : "everyone";
  const [role, setRole] = useState<GuideRole>(initialRole);

  const chapters = useMemo(() => filterChaptersForRole(role), [role]);

  return (
    <>
      <Seo
        title="User Guide — My Hitech"
        description="Step-by-step instructions for every role: admin, office, measurement, worker, delivery and customer."
      />
      <SiteHeader />
      <main className="container-page py-10 md:py-14">
        <header className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
            <BookOpen className="h-3.5 w-3.5" /> User Guide
          </span>
          <h1 className="mt-4 font-display text-4xl md:text-5xl">How to use My Hitech</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Pick your role to see the steps that apply to you.
          </p>
        </header>

        <div className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {ROLE_OPTIONS.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={role === r.value ? "default" : "outline"}
              onClick={() => setRole(r.value)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
        </div>

        {/* Table of contents */}
        <Card className="mx-auto mt-8 max-w-4xl shadow-card-soft">
          <CardContent className="p-5">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Contents
            </p>
            <ol className="grid list-decimal gap-1 pl-5 text-sm text-foreground/80 sm:grid-cols-2">
              {chapters.map((c) => (
                <li key={c.id}>
                  <a href={`#${c.id}`} className="hover:text-primary hover:underline">
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <div className="mx-auto mt-10 max-w-4xl space-y-10">
          {chapters.map((ch, idx) => (
            <section key={ch.id} id={ch.id} className="scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {idx + 1}
                </div>
                <h2 className="font-display text-2xl md:text-3xl">{ch.title}</h2>
              </div>
              <div className="space-y-4">
                {ch.sections.map((s) => (
                  <Card key={s.id} className="border-border/70">
                    <CardContent className="p-5">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg">{s.title}</h3>
                        {s.audience
                          .filter((a) => a !== "everyone")
                          .map((a) => (
                            <Badge key={a} variant="secondary" className="text-[10px] uppercase">
                              {a}
                            </Badge>
                          ))}
                      </div>
                      {s.intro && (
                        <p className="mb-3 text-sm leading-relaxed text-foreground/80">
                          {s.intro}
                        </p>
                      )}
                      {s.steps && (
                        <ol className="ml-5 list-decimal space-y-1.5 text-sm leading-relaxed text-foreground/85">
                          {s.steps.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ol>
                      )}
                      {s.bullets && (
                        <ul className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-foreground/85">
                          {s.bullets.map((t) => (
                            <li key={t}>{t}</li>
                          ))}
                        </ul>
                      )}
                      {s.fields && s.fields.length > 0 && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Field / Column</th>
                                <th className="px-3 py-2 text-left font-semibold">Purpose / What to enter</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.fields.map((f) => (
                                <tr key={f.name} className="border-t border-border/60 align-top">
                                  <td className="px-3 py-2 font-medium text-foreground">{f.name}</td>
                                  <td className="px-3 py-2 text-foreground/80">{f.purpose}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {s.tip && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{s.tip}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-muted-foreground">
          Version {APP_VERSION} · Last updated {GUIDE_LAST_UPDATED} ·{" "}
          <Link to="/about" className="hover:text-primary hover:underline">About</Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
};

export default UserGuide;