// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { catalogCostFetch } from './catalogCostAccess';
import { backendUrl } from './privateMedia';
const response = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'content-range': '0-0/1' } });
describe('Supplier cost access', () => {
  it('keeps nested catalogue relationships and pagination while loading authorized prices', async () => {
    const native = vi.fn().mockResolvedValueOnce(response([{ id: 'one', product_images: [{ image_url: 'photo' }] }])).mockResolvedValueOnce(response({ one: 120 }));
    const result = await catalogCostFetch(native)(`${backendUrl}/rest/v1/products?select=*,product_images(image_url,display_order)`, { headers: { Authorization: 'Bearer session' } });
    const request = new URL(String(native.mock.calls[0][0]));
    expect(request.searchParams.get('select')).not.toContain('cost_price');
    expect(request.searchParams.get('select')).toContain('product_images(image_url,display_order)');
    expect(await result.json()).toEqual([{ id: 'one', cost_price: 120, product_images: [{ image_url: 'photo' }] }]);
    expect(result.headers.get('content-range')).toBe('0-0/1');
    expect(new Headers(native.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer session');
  });
  it('returns null when the server denies a role access; handles single rows and aliases', async () => {
    const native = vi.fn().mockResolvedValueOnce(response({ id: 'one', name: 'set' })).mockResolvedValueOnce(response({}));
    const result = await catalogCostFetch(native)(`${backendUrl}/rest/v1/product_bundles?select=name,supplier:cost_price`);
    expect(await result.json()).toEqual({ name: 'set', supplier: null });
  });
  it('does not add requests to public-price queries, unrelated origins or writes without returning', async () => {
    const native = vi.fn().mockImplementation(async () => response([]));
    const adapted = catalogCostFetch(native);
    await adapted(`${backendUrl}/rest/v1/products?select=id,mrp`);
    await adapted('https://example.com/rest/v1/products?select=*');
    await adapted(`${backendUrl}/rest/v1/products`, { method: 'POST', body: '{}' });
    expect(native).toHaveBeenCalledTimes(3);
  });
  it('preserves mutation bodies and removes singular accept headers from the bulk price lookup', async () => {
    const native = vi.fn().mockResolvedValueOnce(response({ id: 'one' })).mockResolvedValueOnce(response({ one: 0 }));
    const request = new Request(`${backendUrl}/rest/v1/products?select=*`, { method: 'PATCH', body: JSON.stringify({ cost_price: 0 }), headers: { Accept: 'application/vnd.pgrst.object+json', Authorization: 'Bearer session' } });
    const result = await catalogCostFetch(native)(request);
    expect(await (native.mock.calls[0][0] as Request).json()).toEqual({ cost_price: 0 });
    expect(new Headers(native.mock.calls[1][1].headers).get('Accept')).toBeNull();
    expect(await result.json()).toEqual({ id: 'one', cost_price: 0 });
  });
  it('fails visibly if authorized prices cannot be loaded', async () => {
    const native = vi.fn().mockResolvedValueOnce(response([{ id: 'one' }])).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(catalogCostFetch(native)(`${backendUrl}/rest/v1/products?select=*`)).rejects.toThrow('Unable to load supplier prices');
  });
});

describe('Quotation item price access', () => {
  it('restores office prices while keeping price columns out of the base query', async () => {
    const native = vi.fn().mockResolvedValueOnce(response([{ id: 'one', quantity: 2 }])).mockResolvedValueOnce(response({ one: { unit_price: 100, amount: 200 } }));
    const result = await catalogCostFetch(native)(`${backendUrl}/rest/v1/quotation_items?select=*`);
    const select = new URL(String(native.mock.calls[0][0])).searchParams.get('select');
    expect(select).not.toContain('unit_price');
    expect(select).not.toContain('amount');
    expect(await result.json()).toEqual([{ id: 'one', quantity: 2, unit_price: 100, amount: 200 }]);
    expect(JSON.parse(native.mock.calls[1][1].body).catalog_kind).toBe('quotation_items');
  });
  it('masks prices for delivery roles and preserves aliases', async () => {
    const native = vi.fn().mockResolvedValueOnce(response({ id: 'one', quantity: 2 })).mockResolvedValueOnce(response({}));
    const result = await catalogCostFetch(native)(`${backendUrl}/rest/v1/quotation_items?select=quantity,price:unit_price,line:amount`);
    expect(await result.json()).toEqual({ quantity: 2, price: null, line: null });
  });
});
