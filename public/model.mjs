// All currency calculations follow Excel ROUND(value, 0), including negative ties.
export const round = (n) => Math.sign(n) * Math.floor(Math.abs(n) + 0.5 + 1e-9);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
export const clone = (x) => JSON.parse(JSON.stringify(x));

export const reference = {
  price: 2, milkPrice: 20000, yield: 20000, minimumMilk: 1,
  salaries: 10000, bonusRate: 0.05, taxRate: 0.1, life: 8,
  interestRate: 0.1, salesBlock: 10000, allocationBlock: 10000, minimumMarketing: 1000,
  marketingResolved: true, stockRule: 'dispose', disposalPerUnit: 0, forecast: 410000,
  premises: [
    { name: 'A', slots: 1, transport: 0.3, rent: 12000 },
    { name: 'B', slots: 1, transport: 0.4, rent: 10000 },
    { name: 'C', slots: 1, transport: 0.3, rent: 12000 },
    { name: 'D', slots: 1, transport: 0.1, rent: 17000 },
    { name: 'E', slots: 2, transport: 0.2, rent: 15000 },
    { name: 'F', slots: 3, transport: 0.2, rent: 16000 }
  ],
  machines: [
    { name: 'Machine 1', capacity: 72000, price: 35000, maintenance: 1800 },
    { name: 'Machine 2', capacity: 120000, price: 95000, maintenance: 2900 },
    { name: 'Machine 3', capacity: 68000, price: 38000, maintenance: 2100 },
    { name: 'Machine 4', capacity: 95000, price: 70000, maintenance: 2900 },
    { name: 'Machine 5', capacity: 45000, price: 28000, maintenance: 1300 },
    { name: 'Machine 6', capacity: 110000, price: 90000, maintenance: 2900 }
  ]
};

export function emptyScenario(name) {
  return { name, milk: 0, marketing: 0, requested: 0, actual: 0,
    borrowing: 0, term: 0, extraRepayment: 0,
    purchases: [0, 0, 0, 0, 0, 0],
    premises: reference.premises.map(() => ({ rented: false, production: 0, machines: [0, 0, 0, 0, 0, 0] })) };
}
export function defaults() {
  const conservative = emptyScenario('Conservative');
  Object.assign(conservative, { milk: 2, marketing: 3000, requested: 40000, actual: 40000 });
  conservative.purchases[4] = 1;
  conservative.premises[3] = { rented: true, production: 40000, machines: [0, 0, 0, 0, 1, 0] };
  const growth = emptyScenario('Growth');
  Object.assign(growth, { milk: 3, marketing: 6000, requested: 60000, actual: 60000 });
  growth.purchases[0] = 1;
  growth.premises[3] = { rented: true, production: 60000, machines: [1, 0, 0, 0, 0, 0] };
  return { version: 1, rules: clone(reference), opening: { cash: 0, losses: 0, annualProfit: 0,
    confirmed: false, assets: [], loans: [] }, scenarios: [conservative, growth],
    recommendation: 'Provisional preference: Conservative, provided the opening cash covers its advance payments and the trainer allocates sufficient sales.',
    keyAssumption: 'Replace the zero opening balances and confirm the Year 2 rules before committing. Requested sales are not guaranteed.' };
}

export function calculate(s, o, r, { workbookReplay = false } = {}) {
  const errors = [], notes = [];
  const check = (condition, text) => { if (!condition) errors.push(text); };
  const number = (value, name, { integer = false, positive = false, negative = false } = {}) => {
    check(typeof value === 'number' && Number.isFinite(value) && (negative || value >= 0) && (!integer || Number.isInteger(value)) && (!positive || value > 0), `${name}: enter a valid ${positive ? 'positive ' : ''}${integer ? 'whole ' : ''}number${negative ? '' : ' (zero or above)'}.`);
  };
  number(o.cash, 'Opening cash', { negative: true, integer: true }); number(o.losses, 'Opening tax losses', { integer: true });
  number(o.annualProfit, 'Year 1 annual profit', { negative: true });
  for (const k of ['milk', 'marketing', 'borrowing', 'extraRepayment']) number(s[k], k, { integer: k === 'borrowing' || k === 'extraRepayment' });
  for (const k of ['requested', 'actual', 'term']) number(s[k], k, { integer: true });
  for (const k of ['price', 'milkPrice', 'minimumMilk', 'salaries', 'disposalPerUnit']) number(r[k], k);
  for (const k of ['yield', 'life', 'salesBlock', 'allocationBlock']) number(r[k], k, { positive: true, integer: true });
  number(r.forecast, 'Market forecast', { integer: true });
  for (const k of ['bonusRate', 'taxRate', 'interestRate']) { number(r[k], k); check(r[k] <= 1, `${k}: enter a rate between 0 and 1.`); }
  number(r.minimumMarketing, 'Minimum marketing');
  check(['unconfirmed', 'expense', 'dispose'].includes(r.stockRule), 'Choose a valid stock rule.');
  r.machines.forEach((m, i) => {
    for (const k of ['capacity', 'price', 'maintenance']) number(m[k], `Machine ${i + 1} ${k}`, { integer: k === 'capacity' });
    number(s.purchases[i], `Machine ${i + 1} purchases`, { integer: true });
  });
  r.premises.forEach((p, i) => {
    number(p.slots, `Premise ${p.name} slots`, { integer: true });
    number(p.rent, `Premise ${p.name} rent`); number(p.transport, `Premise ${p.name} transport`);
    number(s.premises[i].production, `Premise ${p.name} production`, { integer: true });
    s.premises[i].machines.forEach((q, j) => number(q, `Premise ${p.name}, machine ${j + 1} count`, { integer: true }));
  });
  o.assets.forEach((a, i) => {
    number(a.type, `Owned asset ${i + 1} type`, { integer: true }); check(a.type < 6, `Owned asset ${i + 1}: invalid machine type.`);
    number(a.quantity, `Owned asset ${i + 1} quantity`, { integer: true });
    number(a.remaining, `Owned asset ${i + 1} remaining life`, { integer: true });
    number(a.depreciation, `Owned asset ${i + 1} depreciation`);
    if (a.quantity > 0 && a.remaining > 0) check(a.depreciation > 0, `Owned asset ${i + 1}: enter its historical depreciation per machine per season.`);
  });
  o.loans.forEach((l, i) => { number(l.principal, `Loan ${i + 1} balance`, { integer: true }); number(l.scheduled, `Loan ${i + 1} scheduled repayment`, { integer: true }); check(l.principal === 0 || l.scheduled > 0, `Loan ${i + 1}: enter the contractual scheduled principal payment.`); });
  if (errors.length) return { calculable: false, feasible: false, errors, notes };

  const production = sum(s.premises.map(p => p.production));
  check(s.milk >= r.minimumMilk, `Milk purchase is below the ${r.minimumMilk}-ton reference minimum.`);
  if (r.minimumMarketing !== null) check(s.marketing >= r.minimumMarketing, `Marketing is below the entered minimum of Sh ${r.minimumMarketing}.`);
  check(s.requested % r.salesBlock === 0, `Requested sales must use blocks of ${r.salesBlock.toLocaleString('en-US')}.`);
  check(s.actual % r.allocationBlock === 0, `Actual allocated sales must use blocks of ${r.allocationBlock.toLocaleString('en-US')}.`);
  check(production <= s.milk * r.yield, 'Production exceeds the milk yield.');
  check(s.actual <= production, 'Actual allocated sales exceed production.');
  check(s.requested <= production, 'Requested sales exceed planned stock.');
  check(s.actual <= s.requested, 'Actual allocated sales exceed requested sales; confirm the trainer allocation.');
  check(s.borrowing === 0 || s.term > 0, 'Enter a positive loan term for new borrowing.');
  check(s.borrowing === 0 || s.term <= 8, 'Year 2 winter loans must have a term of 1–8 seasons and finish by Year 3 autumn.');
  o.loans.forEach((l, i) => check(l.scheduled * 8 >= l.principal, `Opening loan ${i + 1}: scheduled payments must clear the balance by Year 3 autumn; confirm its original contract.`));
  const available = r.machines.map((_, i) => s.purchases[i] + sum(o.assets.filter(a => a.type === i && a.remaining > 0).map(a => a.quantity)));
  const installed = r.machines.map((_, j) => sum(s.premises.map(p => p.machines[j])));
  installed.forEach((n, i) => check(n <= available[i], `Machine ${i + 1}: installed quantity exceeds usable owned machines plus purchases.`));
  s.premises.forEach((p, i) => {
    const capacity = sum(p.machines.map((q, j) => q * r.machines[j].capacity));
    check(p.rented || (p.production === 0 && sum(p.machines) === 0), `Premise ${r.premises[i].name}: rent it before installing machines or producing.`);
    check(sum(p.machines) <= r.premises[i].slots, `Premise ${r.premises[i].name}: machine slots exceeded.`);
    check(p.production <= capacity, `Premise ${r.premises[i].name}: production exceeds installed capacity.`);
  });
  // Historical replay preserves the source defect. Forecasts follow participant rule 07:
  // A–F is the recorded order; residual goes to the last producing premise.
  let allocations;
  if (workbookReplay) {
    allocations = s.premises.slice(0, 5).map(p => production === 0 ? 0 : round(s.actual * p.production / production));
    allocations.push(Math.max(0, s.actual - sum(allocations)));
  } else {
    allocations = Array(6).fill(0);
    const active = s.premises.map((p, i) => p.production > 0 ? i : -1).filter(i => i >= 0);
    active.forEach((i, j) => { allocations[i] = j === active.length - 1 ? s.actual - sum(allocations) : round(s.actual * s.premises[i].production / production); });
  }
  check(sum(allocations) === s.actual, 'Workbook transport rounding does not reconcile allocated sales. Confirm a corrected allocation rule.');
  allocations.forEach((q, i) => check(q >= 0 && q <= s.premises[i].production, `Premise ${r.premises[i].name}: sales allocation is outside its production limits. Confirm allocation before relying on transport.`));
  const revenue = round(s.actual * r.price);
  const milk = round(s.milk * r.milkPrice);
  const maintenance = round(sum(s.purchases.map((q, i) => q * r.machines[i].maintenance)) + sum(o.assets.map(a => a.quantity * r.machines[a.type].maintenance)));
  const depreciation = round(sum(s.purchases.map((q, i) => q * r.machines[i].price / r.life)) + sum(o.assets.filter(a => a.remaining > 0).map(a => a.quantity * a.depreciation)));
  const gross = round(revenue - milk - maintenance - depreciation);
  const bonus = gross > 0 ? round(gross * r.bonusRate) : 0;
  const transport = sum(allocations.map((q, i) => round(q * r.premises[i].transport)));
  const rent = round(sum(s.premises.map((p, i) => p.rented ? r.premises[i].rent : 0)));
  const marketing = round(s.marketing), salaries = round(r.salaries);
  const unsold = Math.max(0, production - s.actual), unusedMilk = Math.max(0, s.milk - production / r.yield);
  const disposal = r.stockRule === 'dispose' ? round(unsold * r.disposalPerUnit) : 0;
  const spoiled = r.stockRule === 'dispose' ? unsold : null;
  const principal = sum(o.loans.map(l => l.principal)) + s.borrowing;
  const scheduled = sum(o.loans.map(l => Math.min(l.principal, l.scheduled))) + (s.borrowing > 0 && s.term > 0 ? Math.min(s.borrowing, round(s.borrowing / s.term)) : 0);
  const extra = Math.min(s.extraRepayment, Math.max(0, principal - scheduled));
  check(s.extraRepayment <= Math.max(0, principal - scheduled), 'Additional repayment exceeds debt after scheduled repayments.');
  const repayment = scheduled + extra;
  const interest = sum(o.loans.map(l => round(l.principal * r.interestRate))) + round(s.borrowing * r.interestRate);
  const beforeTax = round(gross - transport - marketing - bonus - salaries - rent - interest - disposal);
  const lossUsed = beforeTax > 0 ? Math.min(o.losses, beforeTax) : 0;
  const taxable = Math.max(0, beforeTax - lossUsed), tax = round(taxable * r.taxRate);
  const profit = round(beforeTax - tax), losses = Math.max(0, o.losses - lossUsed + Math.max(0, -beforeTax));
  const capex = round(sum(s.purchases.map((q, i) => q * r.machines[i].price)));
  const beforeAdvance = o.cash + s.borrowing;
  const afterMachines = beforeAdvance - capex, afterMilk = afterMachines - milk;
  const afterAdvance = round(afterMilk - marketing);
  const closing = round(afterAdvance + revenue - rent - maintenance - transport - salaries - bonus - repayment - interest - tax - disposal);
  check(o.cash >= 0, 'Opening cash is negative before borrowing.');
  check(beforeAdvance >= 0, 'Cash before advance payments is negative.');
  check(afterAdvance >= 0, `Cash after advance payments is negative: Sh ${Math.abs(afterAdvance).toLocaleString('en-US')}.`);
  check(closing >= 0, `Season-end cash is negative: Sh ${Math.abs(closing).toLocaleString('en-US')}.`);
  if (!o.confirmed) notes.push('Starting balances are temporary placeholders.');
  if (!r.marketingResolved || r.minimumMarketing === null) notes.push('Minimum marketing is unresolved: workbook formula tests Sh 10,000; message says Sh 1,000.');
  if (r.stockRule === 'unconfirmed') notes.push('Stock/spoilage rule is unconfirmed. All milk is expensed, as in the workbook; no invented disposal fee or carryover credit is included.');
  notes.push('Year 2 milk storage at premises A, B and F is not yet defined. No storage benefit is credited.');
  notes.push('Year 1 reference — unconfirmed for Year 2.');
  return { calculable: true, feasible: errors.length === 0, provisional: true, errors, notes,
    revenue, milk, maintenance, depreciation, gross, bonus, transport, rent, marketing, salaries,
    disposal, production, unsold, spoiled, unusedMilk, allocations, beforeTax, lossUsed, taxable, tax, profit,
    losses, capex, beforeAdvance, afterMachines, afterMilk, afterAdvance, closing, interest, scheduled,
    extra, repayment, debt: principal - repayment, fundingGap: Math.max(0, -o.cash, -beforeAdvance, -afterAdvance, -closing),
    inflows: s.borrowing + revenue,
    outflows: capex + milk + marketing + rent + maintenance + transport + salaries + bonus + repayment + interest + tax + disposal,
    // Informational share of milk already expensed, never an additional P&L expense.
    milkAtRisk: round((unsold / r.yield + unusedMilk) * r.milkPrice),
    remainingAssets: o.assets.map(a => ({ ...a, remaining: Math.max(0, a.remaining - 1) })).concat(s.purchases.map((quantity, type) => ({ type, quantity, remaining: r.life - 1, depreciation: r.machines[type].price / r.life })).filter(a => a.quantity > 0)) };
}

export function sensitivity(s, o, r) {
  const production = sum(s.premises.map(p => p.production));
  return [1, .75, .5].map(fraction => {
    // Participant rules table 8 trims allocations in 10,000-unit blocks.
    const actual = Math.floor(Math.min(s.requested * fraction, production) / r.allocationBlock) * r.allocationBlock;
    return { fraction, actual, capped: actual < Math.floor(s.requested * fraction), ...calculate({ ...s, actual }, o, r) };
  });
}

export function historicalValidation() {
  const s = emptyScenario('Year 1 winter as recorded');
  Object.assign(s, { milk: 2, marketing: 3000, requested: 40000, actual: 40000 });
  const o = { cash: 100000, losses: 0, annualProfit: 0, confirmed: true, assets: [], loans: [] };
  const result = calculate(s, o, reference, { workbookReplay: true });
  const demo = emptyScenario('Workbook demonstration');
  Object.assign(demo, { milk: 2, marketing: 1000, requested: 40000, actual: 40000 });
  demo.purchases[4] = 1;
  demo.premises[1] = { rented: true, production: 40000, machines: [0, 0, 0, 0, 1, 0] };
  return { result, corrected: calculate(s, o, reference), expected: { profit: 15300, closing: 115300, afterAdvance: 57000, transport: 8000 },
    demo: calculate(demo, o, reference), demoExpected: { beforeTax: -3560, closing: 71940, losses: 3560 } };
}
