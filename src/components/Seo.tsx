import { useEffect } from "react";

export type SeoProps = {
  title: string;
  description?: string;
  canonical?: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

/** Route metadata is restored on navigation, including tags created by this route. */
export const Seo = ({ title, description, canonical, image, jsonLd, noindex = false }: SeoProps) => {
  useEffect(() => {
    const restore: (() => void)[] = [];
    const prevTitle = document.title;
    document.title = title;
    const set = (selector: string, tag: string, identity: Record<string, string>, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector);
      const existed = !!el;
      if (!el) {
        el = document.createElement(tag);
        Object.entries(identity).forEach(([key, val]) => el!.setAttribute(key, val));
        document.head.appendChild(el);
      }
      const target = el;
      const previous = target.getAttribute(attr);
      target.setAttribute(attr, value);
      restore.push(() => { if (!existed) target.remove(); else if (previous === null) target.removeAttribute(attr); else target.setAttribute(attr, previous); });
    };
    const meta = (key: string, value: string) => {
      const attr = key.startsWith('og:') ? 'property' : 'name';
      set(`meta[${attr}="${key}"]`, 'meta', { [attr]: key }, 'content', value);
    };
    meta('og:title', title); meta('twitter:title', title);
    if (description) { meta('description', description); meta('og:description', description); meta('twitter:description', description); }
    if (image) { meta('og:image', image); meta('twitter:image', image); }
    const url = new URL(canonical || window.location.pathname, 'https://hitechfurniture.online');
    url.search = ''; url.hash = '';
    set('link[rel="canonical"]', 'link', { rel: 'canonical' }, 'href', url.href);
    meta('og:url', url.href);
    meta('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script'); script.type = 'application/ld+json'; script.dataset.seo = 'route';
      script.textContent = JSON.stringify(jsonLd); document.head.appendChild(script);
    }
    return () => { document.title = prevTitle; restore.reverse().forEach(fn => fn()); script?.remove(); };
  }, [title, description, canonical, image, jsonLd, noindex]);
  return null;
};
