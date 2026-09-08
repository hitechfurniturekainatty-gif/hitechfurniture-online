import {it,expect} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {SchemeTargetSelect} from './SchemeTargetSelect';
import type {SchemePeriodRef} from './types';
it('selects the financial year, quarter and target in one control',()=>{
 let result:{source:SchemePeriodRef;key?:string}|undefined;
 render(<SchemeTargetSelect source={{fy:2026,type:'monthly',key:'6'}} months={[]} periods={[{fy_year:2025,period_type:'quarterly',period_key:'Q1',scheme_kind:'bogo',scheme_config:{rules:[{purchaseItem:'Ultra',freeItem:'Ultra',matchMode:'exact',buyQty:10,freeQty:2}]}}]} onChange={(source,key)=>{result={source,key};}}/>);
 const option=screen.getByRole('option',{name:/FY 2025–26 · Q1.*Ultra/}) as HTMLOptionElement;
 fireEvent.change(screen.getByLabelText('Related scheme'),{target:{value:option.value}});
 expect(result?.source).toEqual({fy:2025,type:'quarterly',key:'Q1'});
 expect(result?.key).toBeTruthy();
 expect(screen.queryByLabelText('Scheme financial year')).toBeNull();
});
