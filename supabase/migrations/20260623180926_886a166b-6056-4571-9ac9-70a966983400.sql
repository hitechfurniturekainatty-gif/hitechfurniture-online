CREATE OR REPLACE FUNCTION public.pipeline_notifications_forward()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _url TEXT := 'https://thwleiywbpyccgtacczv.supabase.co/functions/v1/forward-pipeline-notification';
  _anon TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRod2xlaXl3YnB5Y2NndGFjY3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTE2MjksImV4cCI6MjA5MTk4NzYyOX0.9-uqLPahHSnmaEzHm2Cp8Gjdy_lEsjvK20_a_jDQl5c';
BEGIN
  -- Forward ALL source types (quotation, lead, complaint, service, job, delivery).
  PERFORM net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _anon
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
END;
$function$;