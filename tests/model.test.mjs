import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, calculate, clone, reference, historicalValidation, sensitivity, round, emptyScenario } from '../public/model.mjs';
function fixture(){const d=defaults();d.opening.cash=100000;return d;}
test('source workbook replay reconciles all four saved benchmarks but remains invalid',()=>{
  const v=historicalValidation();for(const [k,n] of Object.entries(v.expected))assert.equal(v.result[k],n,k);
  assert.equal(v.result.feasible,false);assert.ok(v.result.errors.some(e=>e.includes('exceed production')));
});
test('independent participant example reconciles profit, cash and losses',()=>{
  const v=historicalValidation();for(const [k,n] of Object.entries(v.demoExpected))assert.equal(v.demo[k],n,k);
  assert.equal(v.demo.profit,-3560);assert.equal(v.demo.feasible,true);
  assert.equal(100000-v.demo.closing+v.demo.profit,28000-3500);
});
test('default zero balances cause advance and closing cash shortfalls',()=>{
  const d=defaults();for(const s of d.scenarios){const r=calculate(s,d.opening,d.rules);assert.equal(r.feasible,false);assert.ok(r.afterAdvance<0);assert.ok(r.closing<0);assert.ok(r.errors.some(e=>e.includes('advance payments')));assert.ok(r.errors.some(e=>e.includes('Season-end')));}
});
test('cash sequence excludes end-of-season revenue from advances',()=>{
  const d=fixture();d.opening.cash=50000;const r=calculate(d.scenarios[0],d.opening,d.rules);
  assert.equal(r.beforeAdvance,50000);assert.equal(r.afterMachines,22000);assert.equal(r.afterMilk,-18000);assert.equal(r.afterAdvance,-21000);
  assert.ok(r.closing>0);assert.equal(r.feasible,false);
});
test('60000 four-season loan pays 15000 principal and 6000 interest immediately',()=>{
  const d=fixture(),s=d.scenarios[0];s.borrowing=60000;s.term=4;
  const r=calculate(s,d.opening,d.rules);assert.equal(r.interest,6000);assert.equal(r.scheduled,15000);assert.equal(r.debt,45000);
  const noLoan=calculate({...s,borrowing:0,term:0},d.opening,d.rules);assert.equal(r.revenue,noLoan.revenue);assert.equal(r.beforeTax,noLoan.beforeTax-6000);
});
test('loan term and excess principal repayment are rejected',()=>{
  const d=fixture(),s=d.scenarios[0];s.borrowing=10000;s.term=9;assert.equal(calculate(s,d.opening,d.rules).feasible,false);
  s.term=0;assert.equal(calculate(s,d.opening,d.rules).feasible,false);s.term=4;s.extraRepayment=8000;
  const r=calculate(s,d.opening,d.rules);assert.equal(r.debt,0);assert.ok(r.errors.some(e=>e.includes('Additional repayment')));
});
test('tax loss offset leaves pretax profit unchanged and reduces tax',()=>{
  const d=fixture(),s=d.scenarios[1];const base=calculate(s,d.opening,d.rules);assert.ok(base.beforeTax>0);
  d.opening.losses=50000;const r=calculate(s,d.opening,d.rules);assert.equal(r.tax,0);assert.equal(r.lossUsed,r.beforeTax);assert.equal(r.losses,50000-r.beforeTax);assert.equal(r.profit,r.beforeTax);
});
test('loss increases carryforward and never creates negative tax or bonus',()=>{
  const d=fixture();d.scenarios[0].actual=0;d.opening.losses=5000;const r=calculate(d.scenarios[0],d.opening,d.rules);
  assert.equal(r.tax,0);assert.equal(r.bonus,0);assert.equal(r.losses,5000-r.beforeTax);
});
test('spoilage is counted once within milk expense',()=>{
  const d=fixture();d.scenarios[0].actual=20000;const r=calculate(d.scenarios[0],d.opening,d.rules);
  assert.equal(r.unsold,20000);assert.equal(r.spoiled,20000);assert.equal(r.milk,40000);assert.equal(r.milkAtRisk,20000);assert.equal(r.disposal,0);
});
test('unused milk is separately reported and remains expensed',()=>{
  const d=fixture();d.scenarios[0].milk=3;const r=calculate(d.scenarios[0],d.opening,d.rules);assert.equal(r.unusedMilk,1);assert.equal(r.milk,60000);assert.equal(r.milkAtRisk,20000);
});
test('idle owned machine is maintained and depreciated at historical amount',()=>{
  const d=fixture();d.opening.assets.push({type:0,quantity:1,remaining:2,depreciation:4375});
  const r=calculate(d.scenarios[0],d.opening,d.rules);assert.equal(r.maintenance,3100);assert.equal(r.depreciation,7875);assert.equal(r.remainingAssets[0].remaining,1);
});
test('expired retained machine costs maintenance but cannot operate',()=>{
  const d=fixture();d.opening.assets.push({type:4,quantity:1,remaining:0,depreciation:3500});d.scenarios[0].purchases[4]=0;
  const r=calculate(d.scenarios[0],d.opening,d.rules);assert.equal(r.depreciation,0);assert.equal(r.maintenance,1300);assert.equal(r.feasible,false);
});
test('premise capacity, slots and rent are checked directly',()=>{
  const d=fixture(),s=d.scenarios[0];s.premises[3].production=50000;assert.ok(calculate(s,d.opening,d.rules).errors.some(e=>e.includes('installed capacity')));
  s.premises[3].machines[0]=1;assert.ok(calculate(s,d.opening,d.rules).errors.some(e=>e.includes('slots exceeded')));
  s.premises[3].rented=false;assert.ok(calculate(s,d.opening,d.rules).errors.some(e=>e.includes('rent it')));
});
test('rules transport example allocates 42000 and 28000 with no phantom F sales',()=>{
  const d=fixture(),s=emptyScenario('Transport');s.milk=5;s.marketing=1000;s.requested=70000;s.actual=70000;
  s.premises[0].production=60000;s.premises[1].production=40000;
  const r=calculate(s,d.opening,d.rules);assert.deepEqual(r.allocations,[42000,28000,0,0,0,0]);assert.equal(r.transport,23800);assert.equal(r.unsold,30000);
});
test('sensitivity rounds to allocation blocks and does not alter inputs',()=>{
  const d=fixture(),before=clone(d);const rows=sensitivity(d.scenarios[1],d.opening,d.rules);assert.deepEqual(rows.map(r=>r.actual),[60000,40000,30000]);assert.deepEqual(d,before);
  assert.ok(rows[2].profit<rows[0].profit);assert.ok(rows[2].unsold>rows[0].unsold);
});
test('request and actual allocation block constraints are independent',()=>{
  const d=fixture();d.scenarios[0].actual=35000;assert.ok(calculate(d.scenarios[0],d.opening,d.rules).errors.some(e=>e.includes('Actual allocated sales must')));
});
test('missing or nonfinite inputs suppress financial results',()=>{
  for(const bad of [null,NaN,Infinity,-1]){const d=fixture();d.scenarios[0].milk=bad;const r=calculate(d.scenarios[0],d.opening,d.rules);assert.equal(r.calculable,false);assert.equal(r.profit,undefined);}
});
test('negative opening cash is explicitly flagged before borrowing',()=>{
  const d=fixture();d.opening.cash=-100;d.scenarios[0].borrowing=100000;d.scenarios[0].term=8;
  assert.ok(calculate(d.scenarios[0],d.opening,d.rules).errors.some(e=>e.includes('Opening cash is negative')));
});
test('cash change reconciles to profit plus depreciation less capex and principal plus borrowing',()=>{
  const d=fixture();d.scenarios[0].borrowing=60000;d.scenarios[0].term=4;
  for(const s of d.scenarios){const r=calculate(s,d.opening,d.rules);assert.equal(r.closing-d.opening.cash,r.profit+r.depreciation-r.capex-r.repayment+s.borrowing);assert.equal(r.closing,d.opening.cash+r.inflows-r.outflows);}
});
test('Excel-style rounding handles negative halves',()=>{assert.equal(round(-2.5),-3);assert.equal(round(2.5),3);});
test('annual reference profit has no impact on winter tax or cash',()=>{
  const d=fixture();const a=calculate(d.scenarios[0],d.opening,d.rules);d.opening.annualProfit=999999;
  const b=calculate(d.scenarios[0],d.opening,d.rules);assert.equal(a.tax,b.tax);assert.equal(a.closing,b.closing);
});
test('historical benchmark cannot change when Year 2 rules are edited',()=>{
  const d=fixture();d.rules.price=100;assert.equal(historicalValidation().result.profit,15300);assert.equal(reference.price,2);
});
