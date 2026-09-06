import { describe, it, expect } from 'vitest';
import { computeAchievementPct, computeFreeReport, matchesSchemeRule } from './utils';
import type { Row } from './types';
const row = (item: string, qty: number): Row => ({ id: item, item, qty, price: 100, amountWithTax: qty * 100, mrp: 150 });
const rule = { purchaseItems: ['Comfobond', 'Ultra', 'Imperio'], matchMode: 'family', familyExplicit: true, buyQty: 10, freeQty: 2, freeItem: 'Gift mattress' };
const report = (rows: Row[], r = rule) => computeFreeReport({ kind: 'bogo', config: { rules: [r] } }, rows);
describe('pooled quantity schemes', () => {
 it('keeps an achieved target at 100 percent while showing the next target', () => { expect(computeAchievementPct({kind:'bogo',config:{rules:[rule]}},[row('Ultra',10)])).toBe(100); expect(report([row('Ultra',10)]).targets[0].gap).toBe(10); });
 it('combines variants and sizes into one reward', () => { const r = report([row('Comfobond 75x60', 5), row('Ultra 78x72', 5)]); expect(r.rep[0].free).toBe(2); expect(r.rep[0].qty).toBe(10); });
 it('shows remaining target for mixed products', () => { const r = report([row('Comfobond',3),row('Ultra',2),row('Imperio',1)]); expect(r.rep[0].free).toBe(0); expect(r.targets[0].gap).toBe(4); });
 it('repeats rewards for completed sets only', () => { expect(report([row('Ultra',25)]).rep[0].free).toBe(4); });
 it('does not include unrelated products', () => { expect(report([row('Other',100)]).rep[0].qty).toBe(0); });
 it('counts overlapping selectors only once', () => { expect(report([row('Ultra',5)], {...rule, purchaseItems:['Ultra','Ultra']}).rep[0].qty).toBe(5); });
 it('requires explicit family matching', () => { expect(matchesSchemeRule({...rule,familyExplicit:false},'Ultra 75x60')).toBe(false); });
 it('preserves exact individual rules', () => { expect(computeFreeReport({kind:'bogo',config:{rules:[{purchaseItem:'Ultra',buyQty:10,freeQty:1,freeItem:'Ultra'}]}},[row('Ultra',10),row('Ultra 75x60',10)]).rep[0].free).toBe(1); });
 it('supports cumulative invoices across a period', () => { expect(report([row('Comfobond',4),row('Ultra',3),row('Imperio',3)]).rep[0].free).toBe(2); });
});
