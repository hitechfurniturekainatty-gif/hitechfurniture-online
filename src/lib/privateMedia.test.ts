import { describe,it,expect,vi } from 'vitest';
import { backendUrl,canonicalMedia,mediaUrls,privateMediaFetch } from './privateMedia';
const file=`${backendUrl}/storage/v1/object/public/quotations/folder/a%20b.jpg`;
const signed=`${backendUrl}/storage/v1/object/sign/quotations/folder/a%20b.jpg?token=temporary`;
describe('Private attachments',()=>{
  it('finds nested and newline URLs and removes temporary tokens before persistence',()=>{
    const data={items:[{images:`${signed}\n${file}`,other:'https://example.com/photo.jpg'}]};
    expect(mediaUrls(data)).toHaveLength(2);
    expect(canonicalMedia(data)).toEqual({items:[{images:`${file}\n${file}`,other:'https://example.com/photo.jpg'}]});
  });
  it('signs shared payloads with the original document token, preserving pagination headers',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify([{image:file}]),{headers:{'content-type':'application/json','content-range':'0-0/1'}})).mockResolvedValueOnce(new Response(JSON.stringify({urls:{'folder/a b.jpg':signed}})));
    const response=await privateMediaFetch(fetcher)(`${backendUrl}/rest/v1/rpc/get_shared_quotation`,{method:'POST',body:JSON.stringify({p_token:'document-token'}),headers:{Authorization:'Bearer public','Accept-Profile':'public','Prefer':'return=representation','Range':'0-9'}});
    expect(await response.json()).toEqual([{image:signed}]);
    expect(response.headers.get('content-range')).toBe('0-0/1');
    const signingHeaders = new Headers(fetcher.mock.calls[1][1].headers);
    expect(signingHeaders.get('authorization')).toBe('Bearer public');
    for (const name of ['accept-profile','prefer','range']) expect(signingHeaders.has(name)).toBe(false);
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({paths:['folder/a b.jpg'],rpc:'get_shared_quotation',token:'document-token'});
  });
  it('does not send credentials or signing requests for unrelated origins or catalogue responses',async()=>{
    const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({name:'sofa'}),{headers:{'content-type':'application/json'}}));
    await privateMediaFetch(fetcher)(`${backendUrl}/rest/v1/products`);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await privateMediaFetch(fetcher)('https://example.com/rest/v1/products');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('normalizes outgoing URLs, and fails closed when signing is denied',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({image:file}),{headers:{'content-type':'application/json'}})).mockResolvedValueOnce(new Response('{}',{status:403}));
    await expect(privateMediaFetch(fetcher)(`${backendUrl}/rest/v1/quotation_items`,{method:'PATCH',body:JSON.stringify({image:signed})})).rejects.toThrow('Unable to load private attachments');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({image:file});
  });
});
