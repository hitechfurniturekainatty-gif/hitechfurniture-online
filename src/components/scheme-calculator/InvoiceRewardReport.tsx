import { useState } from 'react';
import type {VendorMonth} from './types';
import {invoiceRewardReceipts,rewardBalances} from './invoiceRewards';
import {fmt} from './utils';

export function InvoiceRewardReport({months}:{months:VendorMonth[]}) {
 const [pendingOnly,setPendingOnly]=useState(false);
 const balances=rewardBalances(months).filter(r=>pendingOnly?r.pending>0:r.eligible>0||r.received>0);
 const receipts=invoiceRewardReceipts(months);
 if(!balances.length&&!receipts.length&&!pendingOnly)return null;
 return <section className="rounded-2xl border bg-card p-4 space-y-3">
  <h3 className="font-semibold">Scheme received & pending / ലഭിച്ചതും ബാക്കിയുള്ളതും</h3>
  <p className="text-xs text-muted-foreground">എല്ലാ വർഷങ്ങളിലെയും monthly schemes. മാർച്ചിലെ reward ജൂണിൽ ലഭിച്ചാൽ മാർച്ചിന്റെ pending കുറയും; ലഭിച്ച invoice-ഉം മാസവും താഴെ കാണാം. Benefit % ബിൽ രേഖപ്പെടുത്തിയ മാസത്തിലാണ് ഉൾപ്പെടുന്നത്.</p>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={pendingOnly} onChange={e=>setPendingOnly(e.target.checked)}/> Pending മാത്രം</label>
  <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['Scheme month','Scheme / item','Eligible','Settled','Pending','Received in / invoice'].map(h=><th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
   <tbody>{balances.map(r=><tr key={r.month+r.key} className="border-t"><td className="p-2">{r.month}</td><td className="p-2">{r.label}</td><td className="p-2">{fmt(r.eligible)}</td><td className="p-2">{fmt(r.received)}</td><td className="p-2 font-semibold text-amber-800">{fmt(r.pending)}</td><td className="p-2">{r.receipts.map(x=>`${x.received_month} · ${x.reference} · ${x.qty} pcs`).join('; ') || '—'}</td></tr>)}</tbody>
  </table>{!balances.length&&<p className="p-2 text-sm text-muted-foreground">No pending scheme targets.</p>}</div>
  {receipts.length>0&&<details><summary className="cursor-pointer text-sm">Invoice reward history / ലഭിച്ച free items ({receipts.length})</summary><div className="mt-2 space-y-2">{receipts.map(r=><p key={r.id} className="rounded border p-2 text-xs">{r.item} · {r.qty} pcs · Scheme: {r.benefit_month} · Received: {r.received_month} · Invoice: {r.reference}{!r.scheme_rule_key&&' · Scheme rule link ഇല്ല — pending-ലേക്ക് ബന്ധിപ്പിക്കാൻ invoice edit ചെയ്യുക.'}</p>)}</div></details>}
 </section>;
}
