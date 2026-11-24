// ERP / DM relay: item + stock push, lead export and Instagram/Facebook DM → lead.
// Copied from the live deployment (version 6) on 2026-11-24 so the code is kept in GitHub.
// Auth: header x-erp-secret must match erp_sync_config.secret.
import { createClient } from "npm:@supabase/supabase-js@2";
import { Image, decode } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
let SECRET = "";
async function secret() { if (!SECRET) { const { data } = await sb.from("erp_sync_config").select("value").eq("key", "secret").single(); SECRET = data?.value || ""; } return SECRET; }

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const strip = (h: string) => (h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
const log = (action: string, code: string, ok: boolean, msg = "") => sb.from("erp_sync_log").insert({ action, code, ok, msg: msg.slice(0, 500) });

async function category(main: string, sub: string | null) {
  main = (main || "Others").trim();
  let { data: m } = await sb.from("main_categories").select("id").ilike("name", main).is("deleted_at", null).limit(1).maybeSingle();
  if (!m) ({ data: m } = await sb.from("main_categories").insert({ name: main, slug: slug(main) + "-" + Date.now().toString(36) }).select("id").single());
  let subId: string | null = null;
  if (sub && sub !== "General") {
    let { data: s } = await sb.from("sub_categories").select("id").eq("main_category_id", m!.id).ilike("name", sub.trim()).is("deleted_at", null).limit(1).maybeSingle();
    if (!s) ({ data: s } = await sb.from("sub_categories").insert({ main_category_id: m!.id, name: sub.trim(), slug: slug(sub) + "-" + Date.now().toString(36) }).select("id").single());
    subId = s!.id;
  }
  return { mainId: m!.id, subId };
}

async function image(code: string, src: string): Promise<string | null> {
  if (!src) return null;
  const { data: map } = await sb.from("erp_image_map").select("src_url,dest_url").eq("product_code", code).maybeSingle();
  if (map && map.src_url === src) return map.dest_url;
  if (src.includes("/storage/v1/object/public/product-images/")) {
    await sb.from("erp_image_map").upsert({ product_code: code, src_url: src, dest_url: src });
    return src;
  }
  const r = await fetch(src);
  if (!r.ok) throw new Error("image fetch " + r.status);
  const buf = new Uint8Array(await r.arrayBuffer());
  let img = await decode(buf) as Image;
  const max = 1600;
  if (img.width > max || img.height > max) img = img.width >= img.height ? img.resize(max, Image.RESIZE_AUTO) : img.resize(Image.RESIZE_AUTO, max);
  const out = await img.encodeJPEG(82);
  const path = `products/erp-${slug(code)}-${Date.now().toString(36)}.jpg`;
  const up = await sb.storage.from("product-images").upload(path, out, { contentType: "image/jpeg", upsert: true });
  if (up.error) throw up.error;
  const dest = sb.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  await sb.from("erp_image_map").upsert({ product_code: code, src_url: src, dest_url: dest, updated_at: new Date().toISOString() });
  return dest;
}

async function item(p: any) {
  const code = String(p.code).trim();
  const { data: ex } = await sb.from("products").select("id,primary_image_url,is_published").eq("product_code", code).maybeSingle();
  const { mainId, subId } = await category(p.main, p.sub);
  const img = await image(code, p.image_url || "");
  const row: any = {
    product_name: p.name, main_category_id: mainId, sub_category_id: subId,
  };
  if (p.hsn) row.hsn_code = p.hsn;
  if (p.gst !== null && p.gst !== undefined && p.gst !== "") row.gst_rate = Number(p.gst);
  const desc = strip(p.description || "");
  if (desc && desc.toLowerCase() !== String(p.name || "").trim().toLowerCase()) row.description = desc;
  if (p.mrp && Number(p.mrp) > 0) row.mrp = Number(p.mrp);
  if (img) row.primary_image_url = img;
  if (ex) {
    if (p.show === 0) row.is_published = false;
    else if (p.show === 1 && (img || ex.primary_image_url)) row.is_published = true;
    const { error } = await sb.from("products").update(row).eq("id", ex.id);
    if (error) throw error;
    if (img && img !== ex.primary_image_url) await sb.from("product_images").insert({ product_id: ex.id, image_url: img, display_order: 0 });
    return { updated: code };
  }
  row.product_code = code; row.mrp = row.mrp ?? 0; row.stock_quantity = 0; row.stock_status = "out_of_stock";
  row.is_published = p.show !== 0 && !!img; row.review_status = "approved"; row.creation_method = "automation_flow";
  const { data, error } = await sb.from("products").insert(row).select("id").single();
  if (error) throw error;
  if (img) await sb.from("product_images").insert({ product_id: data.id, image_url: img, display_order: 0 });
  return { created: code };
}

async function stock(list: { code: string; qty: number }[]) {
  const res = [];
  for (const s of list) {
    const q = Math.max(0, Math.round(Number(s.qty) || 0));
    const { error, count } = await sb.from("products").update({ stock_quantity: q, stock_status: q > 0 ? "in_stock" : "out_of_stock" }, { count: "exact" }).eq("product_code", String(s.code).trim());
    res.push({ code: s.code, qty: q, ok: !error, found: count });
  }
  return res;
}

Deno.serve(async (req) => {
  const sec = await secret();
  if (!sec || req.headers.get("x-erp-secret") !== sec) return new Response("forbidden", { status: 403 });
  let body: any = {};
  try {
    body = await req.json();
    let out;
    if (body.action === "item") out = await item(body.item);
    else if (body.action === "stock") out = await stock(body.items || []);
    else if (body.action === "leads") {
      const { data, error } = await sb.from("sales_leads").select("id,lead_code,customer_name,customer_phone,customer_place,requirement,enquiry_type,source,status,item_image_url,follow_up_notes,created_at").is("deleted_at", null).gt("created_at", body.since || "2000-01-01").order("created_at").limit(200);
      if (error) throw error;
      return Response.json({ ok: true, leads: data });
    }
    else if (body.action === "dm_lead") {
      const src = body.source === "facebook" ? "facebook" : "instagram";
      const sid = String(body.sender_id || "").trim(); const text = String(body.text || "").trim().slice(0, 1000);
      if (!sid || !text) return Response.json({ ok: true, skipped: true });
      const since = new Date(Date.now() - 7 * 864e5).toISOString();
      const { data: ex } = await sb.from("sales_leads").select("id,requirement").eq("social_sender_id", sid).is("deleted_at", null).gt("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (ex) {
        await sb.from("sales_leads").update({ requirement: ((ex.requirement || "") + "\n" + text).slice(-2000) }).eq("id", ex.id);
        out = { appended: ex.id };
      } else {
        const yr = new Date().getFullYear();
        const { data: last } = await sb.from("sales_leads").select("lead_code").like("lead_code", `LD-${yr}-%`).order("lead_code", { ascending: false }).limit(1).maybeSingle();
        const n = last ? parseInt(String(last.lead_code).split("-")[2]) + 1 : 1;
        const code = `LD-${yr}-${String(n).padStart(4, "0")}`;
        const name = (body.name || (src === "instagram" ? "Instagram" : "Facebook") + " user " + sid.slice(-4)).slice(0, 100);
        const { error } = await sb.from("sales_leads").insert({ lead_code: code, customer_name: name, requirement: text, source: src, status: "pending", social_sender_id: sid, follow_up_notes: `Auto-created from ${src} DM (sender ${sid})` });
        if (error) throw error;
        out = { created: code };
      }
    }
    else return new Response("bad action", { status: 400 });
    await log(body.action, body.item?.code || (body.items || []).map((x: any) => x.code).join(","), true, JSON.stringify(out));
    return Response.json({ ok: true, out });
  } catch (e) {
    await log(body.action || "?", body.item?.code || "", false, String((e as any)?.message || e));
    return Response.json({ ok: false, error: String((e as any)?.message || e) }, { status: 500 });
  }
});
