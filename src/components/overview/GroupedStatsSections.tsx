import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { ACCENT_STYLES, type AccentKey } from "./accent";

export type StatCard = { label: string; value: number | null; icon: any; to: string };
export type StatGroup = {
  key: string;
  title: string;
  subtitle: string;
  icon: any;
  accent: AccentKey;
  cards: StatCard[];
};

export const GroupedStatsSections = ({ groups }: { groups: StatGroup[] }) => (
  <div className="space-y-6">
    {groups.map((g) => {
      const a = ACCENT_STYLES[g.accent];
      return (
        <section key={g.key} className={`rounded-2xl border p-4 sm:p-5 ${a.section}`}>
          <div className="mb-3 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${a.iconBox}`}>
              <g.icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold sm:text-xl">{g.title}</h2>
              <p className="text-xs text-muted-foreground">{g.subtitle}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.cards.map((c) => (
              <Link key={c.label} to={c.to} className="block">
                <Card className="bg-card transition-smooth hover:shadow-product">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <span className="truncate">{c.label}</span>
                      <c.icon className={`h-4 w-4 ${a.iconText}`} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {c.value === null ? (
                      <p className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </p>
                    ) : (
                      <p className="font-display text-3xl font-semibold text-foreground">{c.value}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      );
    })}
  </div>
);
