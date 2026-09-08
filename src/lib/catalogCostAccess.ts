import { backendUrl } from './privateMedia';

// Keep normal catalogue queries independent of restricted supplier prices.
// Authorization is enforced by PostgreSQL, never by this adapter.
const columns: Record<string, string> = {
  products: 'id,main_category_id,sub_category_id,product_name,product_code,description,mrp,offer_price,available_colors,material,dimensions,stock_quantity,is_featured,is_published,created_at,updated_at,reorder_level,deleted_at,deleted_by,location_id,stock_status,floor_display_order,hsn_code,gst_rate,primary_material,secondary_material,color_finish,warranty_period,delivery_condition,dim_height,dim_width,dim_depth,primary_image_url,review_status,creation_method,submitted_by,reviewed_by,reviewed_at',
  product_bundles: 'id,bundle_code,name,description,main_category_id,sub_category_id,main_image_url,mrp,offer_price,available_colors,material,dimensions,is_featured,is_published,stock_status,floor_display_order,deleted_at,deleted_by,created_by,created_at,updated_at,location_id,show_item_prices_public,show_item_prices_staff',
};

function fields(select: string): string[] {
  let depth = 0;
  return select.replace(/\s/g, '').split(',').reduce<string[]>((out, part) => {
    if (depth > 0) out[out.length - 1] += ',' + part;
    else out.push(part);
    for (const char of part) depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    return out;
  }, []);
}

export function catalogCostFetch(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const table = url.pathname.replace('/rest/v1/', '');
    if (url.origin !== backendUrl || !columns[table]) return baseFetch(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    // Mutations without RETURNING must remain untouched.
    if (method !== 'GET' && method !== 'HEAD' && !url.searchParams.has('select')) return baseFetch(input, init);
    const selected = fields(url.searchParams.get('select') ?? '*');
    const costFields = selected.filter(field => /^(?:\w+:)?cost_price$/.test(field)).map(field => field.includes(':') ? field.split(':')[0] : field);
    if (selected.includes('*')) costFields.push('cost_price');
    if (!costFields.length) return baseFetch(input, init);
    const safe = selected.flatMap(field => field === '*' ? columns[table].split(',') : /^(?:\w+:)?cost_price$/.test(field) ? [] : [field]);
    const addedId = !safe.includes('id');
    if (addedId) safe.push('id');
    url.searchParams.set('select', [...new Set(safe)].join(','));
    const request = input instanceof Request ? new Request(url, input) : url;
    const response = await baseFetch(request, init);
    if (!response.ok || method === 'HEAD' || response.status === 204) return response;
    const data = await response.clone().json();
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const ids = [...new Set(rows.map(row => row.id).filter(Boolean))];
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('Content-Type', 'application/json');
    headers.delete('Prefer');
    headers.delete('Accept');
    headers.delete('Range');
    const costs: Record<string, number | null> = {};
    for (let offset = 0; offset < ids.length; offset += 1000) {
      const prices = await baseFetch(`${backendUrl}/rest/v1/rpc/get_catalog_costs`, {
        method: 'POST', headers, body: JSON.stringify({ catalog_kind: table, item_ids: ids.slice(offset, offset + 1000) }), signal: init?.signal,
      });
      if (!prices.ok) throw new Error('Unable to load supplier prices. Please refresh and try again.');
      Object.assign(costs, await prices.json());
    }
    for (const row of rows) {
      for (const field of costFields) row[field] = costs[row.id] ?? null;
      if (addedId) delete row.id;
    }
    const resultHeaders = new Headers(response.headers);
    resultHeaders.delete('content-length');
    resultHeaders.delete('content-encoding');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers: resultHeaders });
  };
}
