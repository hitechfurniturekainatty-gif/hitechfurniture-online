import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to live changes on the `quotations` table.
 * Fires `onChange` whenever any row is inserted/updated/deleted by ANY user.
 * Use on list pages (admin quotations index) so staff/admin see each other's
 * edits without manually refreshing.
 *
 * The callback is intentionally simple — caller decides whether to reload,
 * patch in place, or debounce. This avoids tight coupling.
 */
export const useRealtimeQuotations = (onChange: () => void) => {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const channel = supabase
      .channel("rt-quotations-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotations" },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

/**
 * Subscribes to live changes for a single quotation (header + line items).
 * Use inside the editor so two staff members editing the same quote stay in sync.
 * The callback receives a `source` hint so the caller can ignore noisy self-echoes
 * if needed (we still always fire — Supabase doesn't tell us who made the change).
 */
export const useRealtimeQuotation = (
  quotationId: string | undefined,
  onChange: () => void
) => {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!quotationId) return;
    const channel = supabase
      .channel(`rt-quotation-${quotationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quotations",
          filter: `id=eq.${quotationId}`,
        },
        () => onChangeRef.current()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "quotation_items",
          filter: `quotation_id=eq.${quotationId}`,
        },
        () => onChangeRef.current()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);
};