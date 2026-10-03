import { defaults, calculate, sensitivity, historicalValidation, reference } from './model.mjs';

const KEY = 'pork-garlic-year2-v1';
let state = defaults();
let storageMessage = 'Saved on this browser';
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && saved.version === 1 && saved.rules && saved.opening && saved.scenarios?.length === 2) {
    // Fail closed on malformed stored data; nothing is sent to a server.
    saved.scenarios.forEach(s => calculate(s, saved.opening, saved.rules));
    state = saved;
  }
} catch { storageMessage = 'Saved inputs unavailable; defaults loaded'; }
const $ = id => document.getElementById(id);
const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';
const money = n => Number.isFinite(n) ? `Sh ${fmt(n)}` : '—';
const valueAt = path => path.split('.').reduce((x, k) => x[k], state);
function field(path, label, options = {}) {
  const v = valueAt(path);
  return `<label>${esc(label)}<input type="number" data-path="${path}" aria-label="${esc(label)}" value="${v === null ? '' : esc(v)}" step="${options.step || 'any'}" ${options.negative ? '' : 'min="0"'} ${options.max ? `max="${options.max}"` : ''}>${options.help ? `<small>${esc(options.help)}</small>` : ''}</label>`;
}
function checkbox(path, label) { return `<label class="check-label"><input type="checkbox" data-path="${path}" ${valueAt(path) ? 'checked' : ''}>${esc(label)}</label>`; }
function selector(path, label, choices) {
  return `<label>${esc(label)}<select data-path="${path}" aria-label="${esc(label)}">${choices.map(([v, t]) => `<option value="${v}" ${String(valueAt(path)) === String(v) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageMessage = 'Saved on this browser'; }
  catch { storageMessage = 'Storage unavailable — edits will not persist'; }
  $('save-status').textContent = storageMessage;
}
function renderScenario(s, i) {
  const p = `scenarios.${i}`;
  return `<article class="scenario-card ${i ? 'growth' : ''}"><div class="scenario-top"><h3>${esc(s.name)}</h3><p>${i ? 'Higher output and marketing. More sales exposure.' : 'Lower output and spending. Smaller cash commitment.'}</p></div>
    <div class="scenario-inputs"><div class="inputs">
      ${field(`${p}.milk`, `${s.name} milk purchases (tons)`, {step: '.1'})}
      ${field(`${p}.marketing`, `${s.name} marketing (Sh)`, {step:1000})}
      ${field(`${p}.requested`, `${s.name} requested sales`, {step: state.rules.salesBlock})}
      ${field(`${p}.actual`, `${s.name} actual allocated sales`, {step: state.rules.allocationBlock})}
    </div><p class="input-help">Actual sales start as an illustrative allocation. Replace them with the trainer’s result.</p></div>
    <div class="results" id="scenario-result-${i}"></div>
    <div class="scenario-inputs"><details><summary>Production, premises &amp; installed machines</summary><div class="detail-body"><p class="subtle">Production is entered per premise. Installed counts must be backed by owned machines or purchases. Premise order is A–F for transport allocation.</p>
    ${s.premises.map((loc, j) => `<div class="premise"><div class="premise-header">${checkbox(`${p}.premises.${j}.rented`, `Rent ${state.rules.premises[j].name}`)}<small>${state.rules.premises[j].slots} slots · ${money(state.rules.premises[j].rent)}</small></div>${field(`${p}.premises.${j}.production`, `${s.name} production at ${state.rules.premises[j].name}`, {step:10000})}<div class="machine-counts">${loc.machines.map((_, k) => field(`${p}.premises.${j}.machines.${k}`, `Machine ${k+1} installed at ${state.rules.premises[j].name}`, {step:1})).join('')}</div></div>`).join('')}</div></details>
    <details><summary>Machine purchases &amp; financing</summary><div class="detail-body"><div class="inputs">${s.purchases.map((_, j) => field(`${p}.purchases.${j}`, `Buy Machine ${j+1}`, {step:1, help:money(state.rules.machines[j].price)+' each'})).join('')}</div><h4>New loan</h4><div class="inputs">${field(`${p}.borrowing`, `${s.name} borrowing (Sh)`, {step:1000})}${field(`${p}.term`, `${s.name} loan term (seasons)`, {step:1,max:8})}${field(`${p}.extraRepayment`, `${s.name} extra principal repayment (Sh)`, {step:1000})}</div><p class="subtle">First principal and interest are paid this season. Enter opening loans in Starting position.</p></div></details></div></article>`;
}
function renderOpening() {
  $('opening-inputs').innerHTML = `<div class="inputs wide-inputs">${field('opening.cash','Opening cash (Sh)',{negative:true})}${field('opening.losses','Unused tax losses (Sh)')}${field('opening.annualProfit','Year 1 annual profit (Sh)',{negative:true,help:'Reference only; zero is a placeholder, not winter profit.'})}</div>${checkbox('opening.confirmed','I have replaced all starting figures with actual autumn closing balances')}
    <h3>Owned machines</h3><p class="subtle">Zero machines until you add the actual register. Group only identical copies with the same remaining life and depreciation. Retained expired machines still incur maintenance but cannot operate.</p>
    ${state.opening.assets.map((a,i) => `<div class="asset-row">${selector(`opening.assets.${i}.type`,'Owned machine type',state.rules.machines.map((m,j)=>[j,m.name]))}${field(`opening.assets.${i}.quantity`,'Owned quantity',{step:1})}${field(`opening.assets.${i}.remaining`,'Remaining life (seasons)',{step:1})}${field(`opening.assets.${i}.depreciation`,'Depreciation per machine (Sh)',{help:'Historical seasonal charge, not Year 2 replacement price.'})}<button class="remove" data-remove="assets.${i}" aria-label="Remove owned machine group ${i+1}">Remove</button></div>`).join('')}<button class="quiet add" data-add="assets">Add owned machine group</button>
    <h3>Outstanding loans</h3><p class="subtle">Zero debt until you enter the actual loan balances. Use each contract’s scheduled installment; the last payment is capped at the remaining principal. Extra repayments apply after the scheduled total.</p>
    ${state.opening.loans.map((l,i)=>`<div class="asset-row loan-row">${field(`opening.loans.${i}.principal`,'Outstanding principal (Sh)')}${field(`opening.loans.${i}.scheduled`,'Scheduled principal this season (Sh)')}<button class="remove" data-remove="loans.${i}" aria-label="Remove opening loan ${i+1}">Remove</button></div>`).join('')}<button class="quiet add" data-add="loans">Add outstanding loan</button>`;
}
function renderRules() {
  const ruleFields = [['price','Selling price (Sh/unit)'],['milkPrice','Milk price (Sh/ton)'],['yield','Yield (units/ton)'],['minimumMilk','Minimum milk (tons)'],['minimumMarketing','Minimum marketing (Sh)'],['salaries','Seasonal fixed salaries (Sh)'],['bonusRate','Bonus rate (decimal)'],['taxRate','Tax rate (decimal)'],['interestRate','Seasonal interest (decimal)'],['life','New machine life (seasons)'],['salesBlock','Request block (units)'],['allocationBlock','Allocation block (units)'],['forecast','Year 2 winter market forecast (units)']];
  $('rules-inputs').innerHTML = `<div class="callout">The participant rules resolve the Year 1 minimum marketing at Sh 1,000 and require spoilage of unused milk and unsold ice cream. A, B and F are marked for possible Year 2 milk storage, but its terms have not been supplied. The forecast of 410,000 is for the whole market, with a ±20% range (328,000–492,000), not your company’s guaranteed allocation.</div><div class="inputs wide-inputs">${ruleFields.map(([k,l])=>field('rules.'+k,l)).join('')}</div>
    <div class="two-col">${selector('rules.stockRule','End-of-season stock treatment',[['dispose','Year 1 reference: unused milk and unsold ice cream spoil'],['unconfirmed','Unconfirmed: show unsold stock; expense purchased milk'],['expense','Scenario assumption: milk fully expensed, spoilage unspecified']])}${field('rules.disposalPerUnit','Additional disposal fee (Sh/unsold unit)',{help:'Year 1 has no separate fee. Zero avoids counting milk twice. Change only for a confirmed Year 2 fee.'})}</div>
    <p class="subtle">No carryover asset or milk-storage benefit is modeled. If Year 2 introduces storage, the accounting and storage-capacity rules must be added before relying on that benefit.</p>
    <details><summary>Edit premises and machine options</summary><div class="detail-body"><h3>Premises</h3><div class="table-wrap"><table><thead><tr><th>Premise</th><th>Slots</th><th>Rent (Sh)</th><th>Transport (Sh/unit)</th></tr></thead><tbody>${state.rules.premises.map((p,i)=>`<tr><td>${p.name}${['A','B','F'].includes(p.name)?' · P':''}</td>${['slots','rent','transport'].map(k=>`<td>${field(`rules.premises.${i}.${k}`,`${p.name} ${k}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><h3>Machines</h3><div class="table-wrap"><table><thead><tr><th>Machine</th><th>Capacity</th><th>Purchase (Sh)</th><th>Maintenance (Sh)</th></tr></thead><tbody>${state.rules.machines.map((m,i)=>`<tr><td>${m.name}</td>${['capacity','price','maintenance'].map(k=>`<td>${field(`rules.machines.${i}.${k}`,`${m.name} ${k}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div></details>
    <details><summary>Calculation rules and source references</summary><ul class="note-list"><li>Milk is the only costed ingredient. Expense every purchased ton once, including its spoiled portion (participant rules 05 and table 7; workbook Profit and Loss B5).</li><li>Maintain all owned machines, including idle and retained expired copies. Depreciate active-life copies even when idle. New depreciation is purchase price divided by useful life (rules 02–04).</li><li>Revenue uses actual allocated sales. Transport uses proportional production by premise, whole-unit rounding, with the residual at the last producing premise in A–F order (rule 07). Invalid allocations are flagged.</li><li>Opening cash plus borrowing funds machines, milk and marketing before sales receipts. Rent, maintenance, transport, salary, bonus, bank payments and tax are settled at season end (rule 08, table 11; Cash Flow B4:B19).</li><li>Loan terms are 1–8 seasons. Year 2 winter borrowing must finish by Year 3 autumn. Interest applies before repayment; principal begins in the borrowing season (rule 08; Loans F4:K4).</li><li>Bonus is 5% of positive gross profit. Carried losses offset positive profit before tax; tax never applies to a loss (rule 09; Tax Losses B4:B9).</li><li>Post each monetary line in whole shekels and calculate subtotals from posted lines. Currency inputs and outputs use virtual game shekels (rule 10).</li><li>Source files: Pork_and_Garlic_Ice_Cream_Year1.xlsx and Pork and Garlic Ice Cream Year 1 Participant Rules - Visual Revised.docx. Year 2 changes remain unconfirmed.</li></ul></details>`;
}
function table(headers, rows) { return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
function resultCard(r) {
  if (!r.calculable) return `<div class="status">Enter valid inputs to calculate.</div><ul class="warnings">${r.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`;
  return `<div class="metric-row"><div class="metric"><span>Projected net profit · provisional</span><strong class="${r.profit<0?'negative':'positive'}">${money(r.profit)}</strong></div><div class="metric"><span>Closing cash · provisional</span><strong class="${r.closing<0?'negative':''}">${money(r.closing)}</strong></div></div><div class="status ${r.feasible?'ready':''}">${r.feasible?'No numeric shortfall under the entered assumptions. Year 2 rules remain provisional.':`Plan needs attention${r.fundingGap>0?' · cash gap '+money(r.fundingGap):''}`}</div><p class="subtle">Production: ${fmt(r.production)} · Cash after advances: <strong class="${r.afterAdvance<0?'negative':''}">${money(r.afterAdvance)}</strong></p>${r.errors.length?`<ul class="warnings">${r.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}`;
}
function renderResults() {
  const rs = state.scenarios.map(s=>calculate(s,state.opening,state.rules));
  const forecastNote=$('rules-inputs').querySelector('.callout');
  if(forecastNote)forecastNote.textContent=`The participant rules resolve the Year 1 minimum marketing at Sh 1,000 and require spoilage of unused milk and unsold ice cream. A, B and F are marked for possible Year 2 milk storage, but its terms have not been supplied. The entered market forecast is ${fmt(state.rules.forecast)} units; the Year 1 reference ±20% range is ${fmt(state.rules.forecast*.8)}–${fmt(state.rules.forecast*1.2)}. This is total market demand, not guaranteed company sales.`;
  rs.forEach((r,i)=>{$(`scenario-result-${i}`).innerHTML=resultCard(r);});
  $('placeholder-notice').innerHTML = state.opening.confirmed ? '<strong>Year 2 results remain provisional.</strong><span>Starting balances marked complete. Reused Year 1 prices and operating rules still require Year 2 confirmation.</span>' : '<strong>Temporary placeholders — replace with actual Year 1 autumn closing figures.</strong><span>Opening balances start at zero. All Year 2 results are provisional.</span>';
  if (rs.some(r=>!r.calculable)) {
    $('financial-results').innerHTML='<p>Correct the invalid inputs above to compare financial results.</p>';
    $('sensitivity').innerHTML='<p>Sensitivity is unavailable until the inputs are valid.</p>';
    $('assessment').textContent='No plan can be assessed until the invalid inputs are corrected.'; return;
  }
  const [a,b]=rs;
  const pnl=[['Revenue','revenue'],['Milk purchased','milk'],['Machine maintenance','maintenance'],['Depreciation (noncash)','depreciation'],['Gross profit','gross','total'],['Transport','transport'],['Marketing','marketing'],['Bonus','bonus'],['Fixed salaries','salaries'],['Premise rent','rent'],['Loan interest','interest'],['Additional disposal fee','disposal'],['Profit before tax','beforeTax','total'],['Carried tax loss used','lossUsed'],['Taxable profit','taxable'],['Game tax','tax'],['Net profit / loss','profit','total']];
  const row=([label,k,cls])=>`<tr class="${cls||''}"><td>${label}</td>${rs.map(r=>`<td class="${r[k]<0?'negative':''}">${fmt(r[k])}</td>`).join('')}<td>${fmt(b[k]-a[k])}</td></tr>`;
  const cash=[['Opening cash',state.opening.cash,state.opening.cash],['New borrowing',...state.scenarios.map(s=>s.borrowing)],['Cash before machine advance',a.beforeAdvance,b.beforeAdvance,'total'],['Machine purchases',a.capex,b.capex],['Cash before milk advance',a.afterMachines,b.afterMachines,'total'],['Milk purchases',a.milk,b.milk],['Cash before marketing advance',a.afterMilk,b.afterMilk,'total'],['Marketing advance',a.marketing,b.marketing],['Cash after all advances',a.afterAdvance,b.afterAdvance,'total'],['Sales receipts',a.revenue,b.revenue],['Season-end operating payments',...rs.map(r=>r.rent+r.maintenance+r.transport+r.salaries+r.bonus+r.disposal)],['Principal repayments',a.repayment,b.repayment],['Interest',a.interest,b.interest],['Tax',a.tax,b.tax],['Closing cash',a.closing,b.closing,'total'],['Total cash inflows',a.inflows,b.inflows],['Total cash outflows',a.outflows,b.outflows],['Remaining debt',a.debt,b.debt,'total'],['Remaining tax losses',a.losses,b.losses]];
  $('financial-results').innerHTML = `<div class="two-col"><div><h3>Profit and loss</h3>${table(['Sh','Conservative','Growth','Growth − Cons.'],pnl.map(row))}</div><div><h3>Cash sequence &amp; closing balances</h3>${table(['Sh','Conservative','Growth'],cash.map(([l,x,y,c])=>`<tr class="${c||''}"><td>${l}</td><td class="${x<0?'negative':''}">${fmt(x)}</td><td class="${y<0?'negative':''}">${fmt(y)}</td></tr>`))}</div></div>
    <h3 style="margin-top:1.5rem">Why the plans differ</h3><p>Growth changes net profit by <strong>${money(b.profit-a.profit)}</strong> and closing cash by <strong>${money(b.closing-a.closing)}</strong> relative to Conservative.</p>
    <p class="subtle">Revenue changes by ${money(b.revenue-a.revenue)}; milk cost by ${money(b.milk-a.milk)}; rent by ${money(b.rent-a.rent)}; maintenance by ${money(b.maintenance-a.maintenance)}; depreciation by ${money(b.depreciation-a.depreciation)}; transport by ${money(b.transport-a.transport)}; marketing by ${money(b.marketing-a.marketing)}; bonus by ${money(b.bonus-a.bonus)}; interest by ${money(b.interest-a.interest)}; and tax by ${money(b.tax-a.tax)}. Machine purchases change cash outflow by ${money(b.capex-a.capex)} but do not directly reduce profit.</p>
    <p class="subtle">Unsold stock changes by ${fmt(b.unsold-a.unsold)} units. The milk cost tied to unused milk and unsold stock is ${money(a.milkAtRisk)} for Conservative and ${money(b.milkAtRisk)} for Growth, already included in milk expense. It is not charged twice.</p>
    <details><summary>Production, allocation and equipment detail</summary><div class="two-col">${rs.map((r,i)=>`<div><h4>${state.scenarios[i].name}</h4>${table(['Premise','Production','Allocated sold'],state.scenarios[i].premises.map((p,j)=>`<tr><td>${state.rules.premises[j].name}</td><td>${fmt(p.production)}</td><td>${fmt(r.allocations[j])}</td></tr>`))}<p class="subtle">Unused milk: ${fmt(r.unusedMilk)} tons. Unsold stock: ${fmt(r.unsold)} units. Spoiled ice cream: ${r.spoiled===null?'unconfirmed':fmt(r.spoiled)}.</p><p class="subtle">${r.remainingAssets.length?r.remainingAssets.map(x=>`${x.quantity} × ${state.rules.machines[x.type].name}: ${x.remaining} seasons remaining`).join('; '):'No owned machines after this season.'}</p></div>`).join('')}</div></details>`;
  const sens=state.scenarios.map(s=>sensitivity(s,state.opening,state.rules));
  $('sensitivity').innerHTML=`<div class="two-col">${sens.map((rows,i)=>`<div><h3>${state.scenarios[i].name}</h3>${table(['Target','Allocated','Profit (Sh)','Unsold','Closing cash (Sh)'],rows.map(r=>`<tr><td>${r.fraction*100}%${r.capped?'*':''}</td><td>${fmt(r.actual)}</td><td class="${r.profit<0?'negative':''}">${fmt(r.profit)}</td><td>${fmt(r.unsold)}</td><td class="${r.closing<0?'negative':''}">${fmt(r.closing)}</td></tr>`))}<div class="waterfall" aria-label="Closing cash sensitivity">${rows.map(r=>`<div class="bar-column"><b>${money(r.closing)}</b><div class="bar ${r.closing<0?'loss':''}" style="height:${Math.max(3,Math.round(Math.abs(r.closing)/Math.max(1,...rows.map(x=>Math.abs(x.closing)))*70))}px"></div><span>${r.fraction*100}% target</span></div>`).join('')}</div><p class="subtle">At the 50% target, profit changes by ${money(rows[2].profit-rs[i].profit)} and cash by ${money(rows[2].closing-rs[i].closing)} versus the entered allocation. ${rows[2].feasible?'No numeric shortfall in this stress case.':'This stress case has input or cash constraints; it is not feasible as entered.'}</p></div>`).join('')}</div><p class="subtle">* Rounded down to a valid ${fmt(state.rules.allocationBlock)}-unit allocation and capped by production. For Growth, 75% of 60,000 is 45,000, which becomes 40,000 under the Year 1 block rule. Unsold product and unused milk spoil under the selected Year 1 reference treatment. Production infeasibility is not cured by reducing sales.</p>`;
  $('sensitivity').lastElementChild.textContent=`* Rounded down to a valid ${fmt(state.rules.allocationBlock)}-unit allocation and capped by production. Growth's 75% target is ${fmt(state.scenarios[1].requested*.75)} units; the modeled allocation is ${fmt(sens[1][1].actual)}. ${state.rules.stockRule==='dispose'?'Unsold ice cream and unused milk spoil under the selected treatment.':'Spoilage is unconfirmed under the selected treatment; unsold stock is shown without an assumed carryover credit.'} Production infeasibility is not cured by reducing sales.`;
  let assessment;
  if (!a.feasible && !b.feasible) assessment=`Neither plan is feasible as entered. Conservative needs ${money(a.fundingGap)} and Growth needs ${money(b.fundingGap)} of additional opening cash if borrowing is unchanged, plus resolution of any operating warnings. The provisional Conservative preference is not an approval to proceed.`;
  else if (a.feasible && !b.feasible) assessment='Conservative is the only plan without a numeric constraint under the entered assumptions. Growth needs its cash or operating warnings resolved before it can be considered.';
  else if (!a.feasible && b.feasible) assessment='The provisional Conservative preference is not supported by current feasibility checks. Only Growth clears the numeric constraints; confirm starting balances and Year 2 rules before choosing it.';
  else assessment=`Both plans clear the current numeric constraints. ${b.profit>a.profit?'Growth':'Conservative'} has higher projected profit; ${b.closing>a.closing?'Growth':'Conservative'} leaves more closing cash. At the 50% allocation target, Conservative closes with ${money(sens[0][2].closing)} and Growth with ${money(sens[1][2].closing)}. ${sens.some(x=>!x[2].feasible)?'At least one plan fails the stress-case checks.':'Both clear the 50% stress-case checks.'}`;
  $('assessment').innerHTML=`<p class="assessment">${assessment}</p><p class="subtle">A loan sized only to today’s cash gap may be insufficient because it creates same-season principal and interest payments. All recommendations remain provisional until the starting figures and Year 2 rules are confirmed.</p>`;
}
function renderValidation() {
  const v=historicalValidation();
  const matched=Object.keys(v.expected).every(k=>v.result[k]===v.expected[k]);
  $('validation-results').innerHTML=`<div class="callout"><strong>${matched?'Workbook arithmetic reconciles. Historical operational validity does not.':'Workbook arithmetic does not reconcile.'}</strong><p>The workbook records 40,000 actual sales, two tons of milk and Sh 3,000 marketing, but zero production, no rented premises and no machine purchases. Its formula assigns every sale to Premise F anyway. Correct team decisions are needed before winter results can be validated as an actual feasible season.</p></div>
    ${table(['Metric','Workbook saved (Sh)','Calculator replay (Sh)','Difference (Sh)'],[['Net profit','profit'],['Closing cash','closing'],['Cash after advances','afterAdvance'],['Transport','transport']].map(([l,k])=>`<tr><td>${l}</td><td>${fmt(v.expected[k])}</td><td>${fmt(v.result[k])}</td><td>${fmt(v.result[k]-v.expected[k])}</td></tr>`))}
    <p class="subtle">Expected cells: Profit and Loss B19 = 15,300; Cash Flow B19 = 115,300; Cash Flow B10 = 57,000; Sales and Transport B17 = 8,000. Replay uses the workbook’s original residual-to-F formula solely for reconciliation.</p>
    <details open><summary>Discrepancies found and treatment in this calculator</summary><ul class="note-list"><li>Decisions B33 tests Reference Data B9 (salary Sh 10,000) but says Sh 1,000. Participant rules 06 confirm Sh 1,000. The calculator uses that minimum.</li><li>Decisions B39 checks Cash Flow B7 (machine purchases), not B10 (cash after advances). The calculator checks the actual cash sequence.</li><li>Decisions B37 has a cached #VALUE! error. The calculator checks rent, slots and installed capacity directly.</li><li>Sales and Transport C10 assigns residual sales to F, even with no production there. Forecasts use the last producing premise in A–F order. Zero production with positive sales is always invalid; no corrected actual profit is certified.</li><li>The source’s spring–autumn inputs are zero placeholders. Its annual net loss of Sh 14,700 is not an actual Year 1 annual result and is not copied into starting balances.</li></ul></details>
    <h3 style="margin-top:1rem">Independent worked-example check</h3><p class="subtle">Participant rules 11 and workbook Demonstration B17:B19. This is a fictional example, not your team’s result.</p>${table(['Metric','Expected (Sh)','Calculator (Sh)','Difference (Sh)'],[['Profit before tax','beforeTax'],['Closing cash','closing'],['Tax losses','losses']].map(([l,k])=>`<tr><td>${l}</td><td>${fmt(v.demoExpected[k])}</td><td>${fmt(v.demo[k])}</td><td>${fmt(v.demo[k]-v.demoExpected[k])}</td></tr>`))}`;
}
function renderAll() {
  $('scenarios').innerHTML=state.scenarios.map(renderScenario).join('');
  renderOpening(); renderRules(); renderResults(); renderValidation();
  $('recommendation-text').value=state.recommendation;
  $('assumption-text').value=state.keyAssumption;
  $('save-status').textContent=storageMessage;
}
document.addEventListener('input',e=>{
  const path=e.target.dataset.path; if(!path)return;
  const parts=path.split('.'), key=parts.pop(), parent=parts.reduce((x,k)=>x[k],state);
  let v=e.target.type==='checkbox'?e.target.checked:e.target.value;
  if(e.target.type==='number')v=v===''?null:Number(v);
  if(path.endsWith('.type'))v=Number(v);
  parent[key]=v; save(); renderResults();
});
document.addEventListener('click',e=>{
  const add=e.target.dataset.add, remove=e.target.dataset.remove;
  if(add){state.opening[add].push(add==='assets'?{type:0,quantity:0,remaining:0,depreciation:0}:{principal:0,scheduled:0});renderOpening();renderResults();save();}
  if(remove){const [kind,i]=remove.split('.');state.opening[kind].splice(Number(i),1);renderOpening();renderResults();save();}
});
document.addEventListener('change',e=>{
  if(!e.target.dataset.path?.startsWith('rules.'))return;
  const open=Array.from($('scenarios').querySelectorAll('details')).map(d=>d.open);
  $('scenarios').innerHTML=state.scenarios.map(renderScenario).join('');
  Array.from($('scenarios').querySelectorAll('details')).forEach((d,i)=>{d.open=open[i];});
  renderResults();
});
$('reset').addEventListener('click',()=>$('reset-dialog').showModal());
$('cancel-reset').addEventListener('click',()=>$('reset-dialog').close());
$('confirm-reset').addEventListener('click',()=>{state=defaults();save();renderAll();$('reset-dialog').close();});
renderAll();
// Optional, read-only WebMCP inspection shares the exact visible calculation state.
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  Promise.resolve(document.modelContext.registerTool({name:'read_strategy_comparison',title:'Read strategy comparison',description:'Read the current Year 2 scenarios, provisional financial results and validation warnings without changing inputs.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||Object.keys(input).length)throw new Error('No arguments are supported.');return state.scenarios.map(s=>({name:s.name,...calculate(s,state.opening,state.rules)}));}},{signal:lifecycle.signal})).catch(()=>{});
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
