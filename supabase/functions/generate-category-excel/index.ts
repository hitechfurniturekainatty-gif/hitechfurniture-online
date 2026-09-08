import { authorizeStaff } from '../_shared/authorize.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import ExcelJS from 'https://esm.sh/exceljs@4.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function slugify(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '').slice(0, 40) || 'party';
}

const STATUS_LABEL: Record<string, string> = {
  quantity_updated: 'Stock updated (existing item)',
  new_variant_created: 'New colour variant added',
  staged_for_review: 'NEEDS PHOTO + CATEGORY',
  already_staged: 'Already in review list',
};

Deno.serve(async (req) => {
  if (req.method !== 'OPTIONS' && !(await authorizeStaff(req, ['admin','staff'], false))) return new Response(JSON.stringify({error:'Authorized staff access required'}), {status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { invoice_number } = await req.json();
    if (!invoice_number) {
      return new Response(JSON.stringify({ error: 'invoice_number is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: logRows, error: logErr } = await supabase
      .from('invoice_processing_log')
      .select('id, invoice_number, vendor_name, vendor_item_code, item_name, qty, color, cost_price, mrp, offer_price, invoice_date, action, pending_item_id, product_id')
      .eq('invoice_number', invoice_number)
      .order('created_at', { ascending: true });
    if (logErr) throw new Error('logRows: ' + JSON.stringify(logErr));
    if (!logRows || logRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No items found for this invoice_number' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pendingIds = logRows.map((r: any) => r.pending_item_id).filter(Boolean);
    let pendingById = new Map<string, any>();
    if (pendingIds.length) {
      const { data: pendingRows, error: pendErr } = await supabase
        .from('pending_catalog_items')
        .select('id, vendor_item_code, color, primary_material, secondary_material, hsn_code, gst_rate, dim_height, dim_width, dim_depth, color_finish, warranty_period, delivery_condition, notes, suggested_main_category_id, suggested_sub_category_id, main_category_id, sub_category_id')
        .in('id', pendingIds);
      if (pendErr) throw new Error('pendingRows: ' + JSON.stringify(pendErr));
      pendingById = new Map((pendingRows || []).map((p: any) => [p.id, p]));
    }

    const { data: mains, error: mainsErr } = await supabase.from('main_categories').select('id, name').order('name');
    if (mainsErr) throw new Error('mains: ' + JSON.stringify(mainsErr));
    const { data: subs, error: subsErr } = await supabase.from('sub_categories').select('id, name, main_category_id').order('name');
    if (subsErr) throw new Error('subs: ' + JSON.stringify(subsErr));

    const mainNameById = new Map(mains!.map((m: any) => [m.id, m.name]));
    const subNameById = new Map(subs!.map((s: any) => [s.id, s.name]));
    const allSubNames: string[] = [];
    for (const s of subs!) {
      if (!allSubNames.includes(s.name)) allSubNames.push(s.name);
    }
    allSubNames.sort();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Items');

    const listsSheet = workbook.addWorksheet('Lists', { state: 'hidden' });
    mains!.forEach((m: any, i: number) => { listsSheet.getCell(i + 1, 1).value = m.name; });
    allSubNames.forEach((s, i) => { listsSheet.getCell(i + 1, 2).value = s; });

    // Row 1: plain unmerged title cell (no merge -- merges were breaking the
    // round-trip parser used when Harshid sends the filled sheet back).
    const partyName = logRows![0].vendor_name || '';
    const invDate = logRows![0].invoice_date || '';
    sheet.getCell('A1').value = `Party: ${partyName}      Date: ${invDate}`;
    sheet.getCell('A1').font = { bold: true, size: 13, name: 'Arial', color: { argb: 'FF0E5C66' } };
    sheet.getRow(1).height = 24;

    const headers = [
      'S.No', 'Item Name', 'Item Code', 'Qty', 'Cost Price', 'MRP', 'Offer Price',
      'Status', 'Main Category', 'Sub Category', 'Color', 'Primary Material', 'Secondary Material',
      'HSN Code', 'GST Rate', 'Dim Height', 'Dim Width', 'Dim Depth', 'Color Finish',
      'Warranty', 'Delivery Condition', 'Notes', 'Item ID (do not edit)',
    ];
    const editableCols = ['Main Category', 'Sub Category', 'Color', 'Primary Material', 'Secondary Material', 'HSN Code', 'GST Rate', 'Dim Height', 'Dim Width', 'Dim Depth', 'Color Finish', 'Warranty', 'Delivery Condition', 'Notes'];
    const editableColIdx = editableCols.map((c) => headers.indexOf(c) + 1);

    const headerRow = sheet.getRow(2);
    headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E5C66' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    logRows!.forEach((row: any, idx: number) => {
      const needsReview = row.action === 'staged_for_review';
      const pending = row.pending_item_id ? pendingById.get(row.pending_item_id) : null;

      const mainId = pending ? (pending.main_category_id || pending.suggested_main_category_id) : null;
      const subId = pending ? (pending.sub_category_id || pending.suggested_sub_category_id) : null;
      const suggestedMain = mainId ? (mainNameById.get(mainId) || '') : '';
      const suggestedSub = subId ? (subNameById.get(subId) || '') : '';

      const itemIdCell = (needsReview && row.pending_item_id) ? row.pending_item_id : `(${STATUS_LABEL[row.action] || row.action})`;

      const excelRow = sheet.addRow([
        idx + 1,
        row.item_name,
        row.vendor_item_code || '',
        row.qty || 1, Number(row.cost_price) || 0, Number(row.mrp) || 0, Number(row.offer_price) || 0,
        STATUS_LABEL[row.action] || row.action,
        suggestedMain, suggestedSub,
        (pending && pending.color) || row.color || '',
        (pending && pending.primary_material) || '',
        (pending && pending.secondary_material) || '',
        (pending && pending.hsn_code) || '',
        (pending && pending.gst_rate) ?? '',
        (pending && pending.dim_height) ?? '',
        (pending && pending.dim_width) ?? '',
        (pending && pending.dim_depth) ?? '',
        (pending && pending.color_finish) || '',
        (pending && pending.warranty_period) || '',
        (pending && pending.delivery_condition) || '',
        (pending && pending.notes) || '',
        itemIdCell,
      ]);

      if (needsReview) {
        editableColIdx.forEach((ci) => {
          excelRow.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
        });
        excelRow.getCell(headers.indexOf('Status') + 1).font = { bold: true, color: { argb: 'FFCC0000' }, name: 'Arial' };
      } else {
        excelRow.getCell(headers.indexOf('Status') + 1).font = { color: { argb: 'FF1E7B34' }, name: 'Arial' };
      }
      excelRow.getCell(headers.length).font = { size: 8, color: { argb: 'FF999999' }, name: 'Arial' };
    });

    // NOTE: dropdown data validation removed for now -- suspected to interfere
    // with round-trip parsing in n8n's extractFromFile node. Main/Sub Category
    // remain plain text cells; Harshid types the category name directly.

    sheet.columns = [
      { width: 6 }, { width: 28 }, { width: 12 }, { width: 6 },
      { width: 11 }, { width: 11 }, { width: 11 }, { width: 24 },
      { width: 18 }, { width: 22 }, { width: 12 }, { width: 15 }, { width: 15 },
      { width: 11 }, { width: 9 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 13 },
      { width: 12 }, { width: 16 }, { width: 20 }, { width: 30 },
    ];

    const instructions = workbook.addWorksheet('Instructions');
    const lines = [
      'Hitech Furniture - Item Details Sheet',
      '',
      'Party name and date shown once at the top of the Items sheet.',
      'This sheet lists EVERY item from the invoice, whether it was auto stock-updated',
      'or is new / a new colour and needs review.',
      '',
      'Status column:',
      '- "Stock updated" / "New colour variant added" (green) - already done, nothing to fill.',
      '- "NEEDS PHOTO + CATEGORY" (red) - yellow cells below need filling; send the item photo separately too.',
      '',
      'Open this file with Google Sheets (Open with -> Google Sheets).',
      '',
      'How to fill (only rows marked NEEDS PHOTO + CATEGORY):',
      '1. Main Category / Sub Category - type the category name directly.',
      '2. Color, Primary Material, Secondary Material - type directly (e.g. Wooden, Fiber, Metal).',
      '3. HSN Code, GST Rate, Dimensions, Color Finish, Warranty, Delivery Condition, Notes -',
      '   fill whatever you know now; these can also be completed later from the staff portal.',
      '4. AI suggestion already pre-filled where possible - only change what is wrong.',
      '5. Send this file back to the bot (keep filename as-is).',
    ];
    lines.forEach((line, i) => {
      const cell = instructions.getCell(i + 1, 1);
      cell.value = line;
      cell.font = i === 0 ? { bold: true, size: 14, name: 'Arial' } : { name: 'Arial' };
    });
    instructions.getColumn(1).width = 95;
    workbook.views = [{ activeTab: 0 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const partyLabel = slugify(partyName || 'party');
    const dateLabel = (invDate || invoice_number || 'date').toString().slice(0, 10);
    const fileLabel = `${partyLabel}_${dateLabel}`;

    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileLabel}_Item_Details.xlsx"`,
      },
    });
  } catch (err) {
    console.error('generate-category-excel error:', err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err), stack: err instanceof Error ? err.stack : null }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
