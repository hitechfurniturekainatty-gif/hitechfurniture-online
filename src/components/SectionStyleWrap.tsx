import type { CSSProperties, ReactNode } from "react";
import type { BlockStyle } from "@/lib/homeLayout";
import { hexToHsl } from "@/lib/siteTheme";

const isEmpty = (s?: BlockStyle) => !s || Object.values(s).every((v) => v === undefined || v === "" || v === null);

/**
 * Re-themes one home page section: overriding the design-system CSS variables
 * on a wrapper recolours everything inside it (buttons, cards, borders, text).
 * No style saved → renders the section exactly as before.
 */
export function SectionStyleWrap({ style, children }: { style?: BlockStyle; children: ReactNode }) {
  if (isEmpty(style)) return <>{children}</>;
  const s = style!;
  const v: Record<string, string> = {};
  const put = (hex: string | undefined, vars: string[]) => {
    const h = hex ? hexToHsl(hex) : null;
    if (h) vars.forEach((k) => (v[k] = h));
  };
  put(s.bg, ["--background", "--muted", "--secondary"]);
  put(s.text, ["--foreground", "--card-foreground", "--muted-foreground", "--secondary-foreground"]);
  put(s.brand, ["--primary", "--ring"]);
  put(s.brandText, ["--primary-foreground"]);
  put(s.highlight, ["--accent"]);
  put(s.card, ["--card", "--popover"]);
  put(s.borderColor, ["--border"]);
  if (typeof s.radius === "number") v["--radius"] = `${s.radius}rem`;

  const boxed = !!s.boxed || !!s.borderWidth;
  const css: CSSProperties = {
    ...(v as CSSProperties),
    backgroundColor: s.bg || undefined,
    color: s.text || undefined,
    textAlign: s.align,
    paddingTop: typeof s.padY === "number" ? `${s.padY}px` : undefined,
    paddingBottom: typeof s.padY === "number" ? `${s.padY}px` : undefined,
    borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
    borderStyle: s.borderWidth ? s.borderStyle ?? "solid" : undefined,
    borderColor: s.borderWidth ? s.borderColor || "hsl(var(--border))" : undefined,
    borderRadius: boxed && typeof s.radius === "number" ? `${s.radius * 1.5}rem` : boxed ? "1.5rem" : undefined,
    overflow: boxed ? "hidden" : undefined,
  };
  return (
    <div className={boxed ? "container-page my-4" : undefined} data-section-align={s.align}>
      <div style={css} className={s.align ? "section-align" : undefined}>{children}</div>
    </div>
  );
}
