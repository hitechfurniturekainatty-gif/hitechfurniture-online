import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Seo } from "@/components/Seo";
import { ABOUT, APP_VERSION, GUIDE_LAST_UPDATED } from "@/lib/guideContent";
import { BookOpen, Sparkles } from "lucide-react";

const About = () => (
  <>
    <Seo
      title={`About ${ABOUT.appName} — ${ABOUT.tagline}`}
      description={ABOUT.summary.slice(0, 155)}
    />
    <SiteHeader />
    <main className="container-page py-12 md:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> About the app
        </span>
        <h1 className="mt-4 font-display text-4xl md:text-5xl">{ABOUT.appName}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{ABOUT.tagline}</p>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-foreground/80">
          {ABOUT.summary}
        </p>
      </header>

      <Card className="mx-auto mt-10 max-w-3xl shadow-card-soft">
        <CardHeader>
          <CardTitle className="font-display text-xl">What you can do</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {ABOUT.highlights.map((h) => (
              <li key={h} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row">
        <div>
          <p className="font-display text-lg">New here? Read the User Guide.</p>
          <p className="text-sm text-muted-foreground">
            Step-by-step instructions for every role.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/guide"><BookOpen className="mr-2 h-4 w-4" /> Open User Guide</Link>
        </Button>
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Version {APP_VERSION} · Guide updated {GUIDE_LAST_UPDATED}
      </p>
    </main>
    <SiteFooter />
  </>
);

export default About;