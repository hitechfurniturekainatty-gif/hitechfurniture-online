-- WhatsApp agent (n8n vEO4in5LgYu2sHjo) helpers, 2026-10-13.
-- wa_chat_context: last 20 messages with IST time + day gap + what was already sent.
-- wa_find_product_photos: 1-2 catalog photos by category/sub-category words (no cost price;
-- WebP converted to JPG through wsrv.nl because WhatsApp image messages need JPG/PNG).
-- Called only by n8n's Postgres credential (EXECUTE revoked from anon/authenticated).
CREATE OR REPLACE FUNCTION public.wa_chat_context(p_phone text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH m AS (
  SELECT direction, message_text, created_at FROM public.whatsapp_messages
   WHERE public.phone_key(phone) = public.phone_key(p_phone)
   ORDER BY created_at DESC LIMIT 40
), prev_in AS (
  SELECT max(created_at) t FROM m WHERE direction='incoming' AND created_at < now() - interval '2 minutes'
)
SELECT jsonb_build_object(
  'first_contact', NOT EXISTS (SELECT 1 FROM m WHERE created_at < now() - interval '2 minutes'),
  'days_since_last_chat', (SELECT CASE WHEN t IS NULL THEN NULL ELSE floor(extract(epoch FROM now()-t)/86400)::int END FROM prev_in),
  'catalog_link_sent_last_5_days', EXISTS (SELECT 1 FROM m WHERE direction='outgoing' AND message_text ILIKE '%hitechfurniture.online/catalog%' AND created_at > now()-interval '5 days'),
  'follow_us_sent_last_7_days', EXISTS (SELECT 1 FROM m WHERE direction='outgoing' AND message_text ILIKE '%hitechfurniture.online/connect%' AND created_at > now()-interval '7 days'),
  'location_sent_last_5_days', EXISTS (SELECT 1 FROM m WHERE direction='outgoing' AND message_text ILIKE '%maps.app.goo.gl%' AND created_at > now()-interval '5 days'),
  'photos_sent', (SELECT coalesce(jsonb_agg(DISTINCT substring(message_text FROM 'PHOTO SENT: ([^\n]+)')), '[]'::jsonb) FROM m WHERE direction='outgoing' AND message_text LIKE '%PHOTO SENT:%' AND created_at > now()-interval '14 days'),
  'history', (SELECT coalesce(string_agg(
      to_char(created_at AT TIME ZONE 'Asia/Kolkata','DD Mon HH24:MI') || ' ' ||
      CASE WHEN direction='incoming' THEN 'Customer: ' ELSE 'Hitech: ' END ||
      CASE WHEN message_text ~* '^I received a ([[:alnum:]]+) message' THEN '[sent a ' || lower(substring(message_text FROM 'I received a ([[:alnum:]]+)')) || ']'
           ELSE left(regexp_replace(coalesce(message_text,''), '\s+', ' ', 'g'), 300) END,
      E'\n' ORDER BY created_at), '(no earlier messages)')
    FROM (SELECT * FROM m ORDER BY created_at DESC LIMIT 20) x)
)
$function$;

CREATE OR REPLACE FUNCTION public.wa_find_product_photos(p_query text, p_limit integer DEFAULT 2, p_exclude text DEFAULT ''::text)
 RETURNS TABLE(product_name text, category text, sub_category text, offer_price numeric, mrp numeric, photo_url text, catalog_link text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH q AS (
    SELECT ' ' || regexp_replace(lower(coalesce(p_query,'')), '[^[:alnum:]]+', ' ', 'g') || ' ' AS s
  ),
  qn AS (
    SELECT replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(q.s,
      ' kattil ', ' cot '), ' bed ', ' cot '), ' alamara ', ' wardrobe '), ' almirah ', ' wardrobe '),
      ' oonjal ', ' swing '), ' teapoy ', ' coffee table '), ' centre table ', ' coffee table ')
      , ' 3 seater ', ' three seat '), ' three seater ', ' three seat '), ' 2 seater ', ' two seat '), ' two seater ', ' two seat '), ' single seater ', ' single seat ')
      , ' queen ', ' 5 feet '), ' king ', ' 6 feet '), ' single cot ', ' 3 feet cot ') AS s FROM q
  ),
  words AS (SELECT DISTINCT w FROM qn, regexp_split_to_table(trim(qn.s), ' ') w WHERE length(w) >= 3),
  cand AS (
    SELECT p.product_name, m.name cat, m.slug cat_slug, sc.name sub, p.offer_price, p.mrp, p.primary_image_url, p.is_featured, p.created_at,
      (CASE WHEN position(' ' || regexp_replace(lower(m.name), '[^[:alnum:]]+', ' ', 'g') || ' ' IN qn.s) > 0
              OR position(' ' || replace(m.slug,'-',' ') || ' ' IN qn.s) > 0 THEN 20 ELSE 0 END)
    + (CASE WHEN sc.name IS NOT NULL AND position(' ' || regexp_replace(lower(sc.name), '[^[:alnum:]]+', ' ', 'g') || ' ' IN qn.s) > 0 THEN 12 ELSE 0 END)
    + 3 * (SELECT count(*) FROM words WHERE ' ' || regexp_replace(lower(m.name), '[^[:alnum:]]+', ' ', 'g') || ' ' LIKE '% ' || w || ' %')
    + 2 * (SELECT count(*) FROM words WHERE sc.name IS NOT NULL AND ' ' || regexp_replace(lower(sc.name), '[^[:alnum:]]+', ' ', 'g') || ' ' LIKE '% ' || w || '%')
    + 1 * (SELECT count(*) FROM words WHERE lower(p.product_name) LIKE '%' || w || '%') AS score
    FROM qn, public.products_safe_search p
    JOIN public.products pr ON pr.id = p.id AND pr.is_published AND pr.deleted_at IS NULL
    JOIN public.main_categories m ON m.id = p.main_category_id
    LEFT JOIN public.sub_categories sc ON sc.id = p.sub_category_id AND sc.deleted_at IS NULL
    WHERE coalesce(p.primary_image_url,'') <> ''
      AND (coalesce(p_exclude,'') = '' OR position(replace(p.primary_image_url,'https://','') IN p_exclude) = 0)
  ),
  best AS (
    SELECT DISTINCT ON (lower(product_name), coalesce(sub,'')) * FROM cand WHERE score >= 6
    ORDER BY lower(product_name), coalesce(sub,''), score DESC, is_featured DESC NULLS LAST, created_at DESC
  )
  SELECT product_name, cat, sub, offer_price, mrp,
         CASE WHEN primary_image_url ~* '\.(jpe?g|png)(\?|$)' THEN primary_image_url
              ELSE 'https://wsrv.nl/?url=' || replace(primary_image_url,'https://','') || '&output=jpg&w=1080&q=85' END,
         'https://hitechfurniture.online/catalog?cat=' || cat_slug
    FROM best
   ORDER BY score DESC, is_featured DESC NULLS LAST, created_at DESC
   LIMIT greatest(1, least(coalesce(p_limit,2), 3))
$function$;

REVOKE ALL ON FUNCTION public.wa_chat_context(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_find_product_photos(text, int, text) FROM public, anon, authenticated;
