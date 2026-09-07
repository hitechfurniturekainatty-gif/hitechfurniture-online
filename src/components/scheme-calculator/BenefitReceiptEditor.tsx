import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { BenefitReceipt } from './types';
import { receiptBenefit, settledForRule, type SettlementRule } from './settlements';
import { fmt } from './utils';

const blank = (): BenefitReceipt => ({ id: crypto.randomUUID(), kind: 'credit_note', date: new Date().toISOString().slice(0,10), included_in_invoice: false, charge_in_invoice: false });
export function BenefitReceiptEditor({ receipts, onChange, rules = [], defaultMonth, allowMonthChoice = false }: { defaultMonth?: string; allowMonthChoice?: boolean; receipts: BenefitReceipt[]; onChange: (receipts: BenefitReceipt[]) => void; rules?: SettlementRule[] }) {
  const [draft, setDraft] = useState<BenefitReceipt>(blank);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft({...blank(), benefit_month: defaultMonth}); setEditing(false); }, [defaultMonth]);
  const [error, setError] = useState('');
  const patch = (p: Partial<BenefitReceipt>) => { setDraft(d => ({...d,...p})); setError(''); };
  const free = draft.kind === 'free_item';
  const credit = draft.kind === 'credit_note';
  const benefit = receiptBenefit(draft);
  const numeric = (field: keyof BenefitReceipt, label: string) => <div><Label className="text-xs">{label}</Label><Input aria-label={label} type="number" min={0} step="any" value={Number(draft[field]) || ''} onChange={e => patch({[field]: Math.max(0, Number(e.target.value) || 0)})} placeholder="0" /></div>;
  const save = () => {
    if (free && (!draft.item?.trim() || !(Number(draft.qty)>0))) return setError('Enter the received product and quantity.');
    if (!free && !(Number(draft.amount)>0)) return setError('Enter the credit / benefit amount.');
    const units = free ? Number(draft.qty) || 0 : credit ? Number(draft.replaces_free_qty) || 0 : 0;
    if (units && !Number.isInteger(units)) return setError('Enter a whole number of scheme items.');
    if (credit && units > 0 && !draft.scheme_rule_key) return setError('Select the scheme being settled by this credit note.');
    const selected = rules.find(r => r.key === draft.scheme_rule_key);
    if (selected && units > Math.max(0, selected.eligible - settledForRule(selected, rules, receipts.filter(r => r.id !== draft.id)))) return setError('This quantity exceeds the remaining eligible benefit for the selected scheme.');
    const ref = draft.reference?.trim().toLowerCase();
    if (ref && receipts.some(r => r.id !== draft.id && r.kind === draft.kind && r.reference?.trim().toLowerCase() === ref && (r.scheme_rule_key || '') === (draft.scheme_rule_key || ''))) return setError('This reference is already recorded for this scheme. Edit the existing receipt instead.');
    onChange(editing ? receipts.map(r => r.id === draft.id ? draft : r) : [...receipts,draft]);
    setDraft({...blank(),benefit_month:defaultMonth}); setEditing(false); setError('');
  };
  return <section className="benefit-entry space-y-3 rounded-xl border bg-background/60 p-4">
    <div><h5 className="text-sm font-semibold">Additional benefits · അധിക ആനുകൂല്യങ്ങൾ</h5><p className="mt-1 text-xs text-muted-foreground">Onam / Vishu scheme, credit note, cashback, free item എന്നിവ ഇവിടെ ചേർക്കുക. താഴെയുള്ള മൊത്തം benefit-ൽ തുകയും ശതമാനവും സ്വയം പുതുക്കും.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div><Label className="text-xs">Benefit type / ലഭിച്ചത്</Label><Select value={draft.kind} onValueChange={kind => patch({ kind: kind as BenefitReceipt['kind'], qty: undefined, amount: undefined, unit_value: undefined, replaces_free_qty: undefined, vendor_charge: undefined, included_in_invoice: false, charge_in_invoice: false })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free_item">Free / scheme item</SelectItem><SelectItem value="credit_note">Credit note / തുക കുറച്ചുതന്നത്</SelectItem><SelectItem value="cashback">Cashback received</SelectItem><SelectItem value="discount">Discount settlement</SelectItem></SelectContent></Select></div>
      <div><Label className="text-xs">Scheme name / പേര്</Label><Input aria-label="Scheme name" placeholder="Onam / Vishu / Additional" value={draft.scheme_label || ""} onChange={e => patch({scheme_label:e.target.value})} /></div>
      {(free || Number(draft.replaces_free_qty) > 0) && <div><Label className="text-xs">Scheme allocation</Label><Select value={draft.scheme_rule_key || 'unallocated'} onValueChange={key => { const r = rules.find(x => x.key === key); patch({ scheme_rule_key: r?.key, free_item: r?.freeItem, item: r?.freeItem || '', replaces_free_qty: undefined }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unallocated">General benefit / unallocated</SelectItem>{rules.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent></Select></div>}
      <div><Label className="text-xs">{free ? 'Received product' : 'Description'}</Label><Input aria-label="Settlement description" value={draft.item || ''} onChange={e => patch({item:e.target.value})} /></div>
      <div><Label className="text-xs">Credit note / invoice reference</Label><Input aria-label="Settlement reference" value={draft.reference || ''} onChange={e => patch({reference:e.target.value})} /></div>
      {free ? <>{numeric('qty','Quantity received')}{numeric('unit_value','Benefit value per unit ₹')}</> : numeric('amount','Benefit amount / ലഭിച്ച തുക ₹')}
      {credit && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={Number(draft.replaces_free_qty)>0} onChange={e=>patch({replaces_free_qty:e.target.checked?1:undefined})} />ഫ്രീ സാധനത്തിന് പകരമുള്ള credit note ആണെങ്കിൽ തിരഞ്ഞെടുക്കുക</label>}
      {credit && Number(draft.replaces_free_qty)>0 && numeric('replaces_free_qty','Free units settled instead of goods')}
      {free && numeric('vendor_charge','Vendor-ന് കൊടുക്കേണ്ട അധിക തുക ₹')}
      {allowMonthChoice && <div><Label className="text-xs">Benefit month / ഏത് മാസത്തെ benefit</Label><Input aria-label="Benefit month" type="month" value={draft.benefit_month || defaultMonth || ""} onChange={e=>patch({benefit_month:e.target.value})} /></div>}
      <div><Label className="text-xs">Received date</Label><Input aria-label="Received date" type="date" value={draft.date || ''} onChange={e => patch({date:e.target.value})} /></div>
    </div>
    <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium">Invoice-ൽ ഇതിനകം ഉൾപ്പെട്ടതാണോ? / Advanced</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="flex items-start gap-2 rounded-lg border p-3 text-xs"><input type="checkbox" checked={!!draft.included_in_invoice} onChange={e => patch({included_in_invoice:e.target.checked})} /><span>Benefit already included in entered invoice totals. Record receipt only; do not add its value again.</span></label>
      <label className="flex items-start gap-2 rounded-lg border p-3 text-xs"><input type="checkbox" checked={!!draft.charge_in_invoice} onChange={e => patch({charge_in_invoice:e.target.checked})} /><span>Vendor charge already included in entered invoice cost. Do not subtract it again.</span></label>
    </div></details>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 p-3"><div className="text-sm"><b>ഇപ്പോൾ കൂട്ടുന്ന benefit: ₹{fmt(benefit.net)}</b><p className="text-xs text-muted-foreground">₹{fmt(benefit.additionalValue)} benefit − ₹{fmt(benefit.additionalCharge)} additional payable. {free && !draft.unit_value ? 'Enter a unit value to include goods in the percentage.' : ''}</p></div><div className="flex gap-2">{editing && <Button variant="outline" onClick={() => {setDraft({...blank(),benefit_month:defaultMonth});setEditing(false);}}>Cancel edit</Button>}<Button type="button" onClick={save}><Plus className="h-4 w-4" />{editing ? 'Update receipt' : 'Add receipt'}</Button></div></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Add receipt അമർത്തിയ ശേഷം താഴെയുള്ള Save ബട്ടൺ അമർത്തുക. മൊത്തം benefit-ൽ ഈ തുക ഉൾപ്പെടും.</p>
    {receipts.map(r => <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"><b>{r.scheme_label ? `${r.scheme_label} · ` : ""}{r.item || r.kind.replace(/_/g,' ')}</b><span>{r.kind === 'free_item' ? `${r.qty || 0} received` : `₹${fmt(r.amount || 0)}`}</span>{!!r.replaces_free_qty && <span>{r.replaces_free_qty} free units settled by credit</span>}<span>Net addition ₹{fmt(receiptBenefit(r).net)}</span><span>{r.reference} · {r.date}</span><Button aria-label="Edit receipt" size="icon" variant="ghost" className="ml-auto h-8 w-8" onClick={() => {setDraft({...r});setEditing(true);setError('');}}><Pencil className="h-4 w-4" /></Button><Button aria-label="Delete receipt" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { onChange(receipts.filter(x => x.id !== r.id)); if(draft.id===r.id){setDraft({...blank(),benefit_month:defaultMonth});setEditing(false);} }}><Trash2 className="h-4 w-4" /></Button></div>)}
  </section>;
}
