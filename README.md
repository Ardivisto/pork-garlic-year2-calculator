# Pork & Garlic Ice Cream — Year 2 Strategy Calculator

An English-language winter strategy calculator with two independent scenarios, detailed profit and cash statements, production constraints, sales stress tests, editable rules and local browser persistence. It uses plain JavaScript modules and CSS, with no external dependencies or API keys. All amounts are virtual game shekels.

## Run and test

Use Node.js 20 or later. From this directory:

```sh
node server.mjs
```

Open http://127.0.0.1:4173. To use another local port, set `PORT` before starting. Do not open `index.html` directly with a `file:` URL: browser modules require HTTP.

```sh
node tests/model.test.mjs
node scripts/check.mjs
```

The test command runs 22 tests. The build check validates module syntax, local entrypoint assets, and the same financial tests. No dependency installation is necessary. Equivalent npm scripts (`npm start`, `npm test`, `npm run build`) are included.

## Initial scenarios and starting figures

These are suggested comparisons, not recorded company decisions:

| Input | Conservative | Growth |
| --- | ---: | ---: |
| Milk, tons | 2 | 3 |
| Production | 40,000 | 60,000 |
| Requested / illustrative actual sales | 40,000 | 60,000 |
| Marketing | 3,000 | 6,000 |
| Premise | D | D |
| New machine | One Machine 5 | One Machine 1 |
| New borrowing | 0 | 0 |

Conservative uses the winter workbook's milk and marketing quantities, with a small machine sufficient for that output. Growth raises production and marketing and buys the smallest reference machine capable of 60,000 units. D has lower combined rent and transport than B at these sales levels. Both choices remain editable and subject to Year 2 confirmation.

Opening cash, owned-machine register, outstanding loans, tax losses and annual profit start at zero. The empty registers mean zero machines/debt, not missing hidden assets. Add actual autumn closing figures, including each owned cohort's remaining useful life and historical depreciation and each outstanding loan's contractual principal installment. A checkbox records when the user has completed this replacement; it does not confirm Year 2 rules.

With zero opening cash and no borrowing, neither suggested plan is feasible. Conservative has profit −560, closing cash −25,060 and an advance cash gap of 71,000. Growth has profit 10,921, closing cash −19,704 and an advance cash gap of 101,000. The gaps represent additional opening cash with borrowing held fixed, not a recommended loan amount. A loan creates its own same-season principal and interest payments.

## Source material and precedence

Inspected sources:

- `Pork_and_Garlic_Ice_Cream_Year1.xlsx`: formulas, references and saved values in Reference Data, Decisions, Machines, Loans, Sales and Transport, Profit and Loss, Cash Flow, Tax Losses, Summary and Demonstration.
- `Pork and Garlic Ice Cream Year 1 Participant Rules - Visual Revised.docx`: sections 01–11 and their tables.

The participant rules resolve Year 1 contradictions in the generated workbook. Historical replay preserves the workbook's original formula behavior for reconciliation only. Neither source file is modified or distributed in this repository. The shared class submission spreadsheet is not accessed.

Year 2 prices, options and rules are unconfirmed. The page labels their Year 1 reference status. The supplied rules give a Year 2 winter total-market forecast of 410,000 with a ±20% range, not guaranteed company sales. No rule converting marketing into a guaranteed allocation is invented.

## Financial logic

The pure calculation engine is `public/model.mjs`. UI code is in `public/app.mjs`; neither imports a framework. Currency lines use Excel-style rounding to whole shekels, including negative halves. Subtotals use posted rounded lines.

Opening cash, tax-loss balances, loan principal and principal installments must be entered in whole shekels so posted cash and debt reconcile exactly.

1. Revenue = actual allocated sales × selling price (reference Sh 2).
2. Expense all milk purchased (Sh 20,000/ton). Milk produces 20,000 units/ton; at least one ton is required even with no sales.
3. Maintenance applies to all owned machines, including idle and retained expired machines. Expired machines cannot be installed. Depreciation applies during remaining useful life, including idle seasons. New machines depreciate purchase price / 8 reference seasons; existing machines use historical depreciation entered in the register.
4. Gross profit = revenue − milk − maintenance − depreciation.
5. Bonus = 5% of positive gross profit, otherwise zero. Deduct transport, marketing, fixed salaries (Sh 10,000), rent and interest to obtain profit before tax. An explicitly entered Year 2 disposal fee may also be deducted, but the Year 1 reference fee is zero.
6. Positive profit before tax uses carried tax losses first. Tax = 10% of remaining taxable profit. Negative pretax profit adds to the loss pool. Annual profit is reference-only and never substitutes for the loss pool.
7. Cash timing: opening cash + loans; then machine purchases, milk and marketing advances; then sales receipts and season-end operating costs, principal repayments, interest and tax. Display cash before each advance and after all advances. Check negative opening cash, advances and season-end cash. Sales receipts cannot fund advance commitments.
8. New loans have 1–8 season terms, with equal rounded scheduled principal and the first payment in the current winter. Interest is 10% of principal before repayment. Year 2 winter has eight seasons through Year 3 autumn. Opening loans use user-entered contractual installments; they must be sufficient to finish by that deadline. Scheduled and extra principal payments are capped at outstanding balances. Borrowing and principal never enter revenue or expenses.
9. Transport allocates sales proportionally to production. The displayed A–F order is the recorded order; round to whole units and put the residual on the last producing premise. Costs are rounded by premise then summed. Any rounding-induced impossible allocation is flagged, not silently corrected.
10. Validate rented premises, machine slots, capacity, owned/purchased availability, milk yield, production-backed requests and actual sales, minimum marketing (Sh 1,000), and request/allocation blocks (10,000). Invalid numerical values suppress calculations; internally inconsistent plans retain illustrative numbers but are explicitly infeasible.

## Spoilage and Year 2 storage limitation

Year 1 section 05 and table 7 require unused milk and unsold ice cream to spoil. Milk is already fully expensed: the calculator never adds a second cost for that milk. It reports unsold units, unused tons, spoiled units, and the informational portion of milk cost at risk separately.

The Year 1 rules mark A, B and F as possible milk-storage premises in Year 2, but do not define capacity, cost, valuation or timing. The default calculation therefore uses the visibly labeled Year 1 spoilage treatment. Users may mark the stock treatment unconfirmed or enter an additional disposal fee; these controls do not implement an unprovided storage rule. A storage benefit or inventory carryover must not be claimed until the Year 2 rules are supplied and the engine is extended. Replacement/disposal proceeds for machines and other unprovided rules are likewise not invented.

## Sales sensitivity and recommendation

Stress targets are 100%, 75% and 50% of requested sales, capped by production and rounded down to whole allocation blocks. For the initial Growth plan, the 75% target is 45,000 and the modeled allocation is 40,000. Output, milk, marketing and other commitments remain unchanged. Reducing sales does not erase a capacity error.

The editable recommendation starts with a provisional Conservative preference. A separate calculation-based assessment always overrides feasibility claims: neither plan is endorsed while a cash or operating constraint is unresolved. Both the editable recommendation and its key assumption persist locally.

## Historical validation

The historical section uses frozen source inputs, isolated from the Year 2 starting placeholders and editable reference values.

| Metric | Workbook saved | Calculator replay | Difference |
| --- | ---: | ---: | ---: |
| Winter net profit, Profit and Loss B19 | 15,300 | 15,300 | 0 |
| Closing cash, Cash Flow B19 | 115,300 | 115,300 | 0 |
| Cash after advances, Cash Flow B10 | 57,000 | 57,000 | 0 |
| Transport, Sales and Transport B17 | 8,000 | 8,000 | 0 |

This is arithmetic reconciliation, **not validation of a feasible actual winter**. The workbook records 40,000 sales but no production, premises or machines. Its C10 residual formula assigns the sales to F and charges 8,000 transport. The calculator preserves that defect only when `workbookReplay: true` is explicitly used by the historical fixture. Forecast calculations use the participant-rule allocation. The real winter premises, production and machine records are still needed before a corrected actual profit can be certified.

Other workbook defects corrected for forecasting:

- Decisions B33 checks salary cell Reference Data B9 (10,000) instead of the marketing minimum. Participant rules 06 establish 1,000.
- Decisions B39 checks Cash Flow B7 (machine purchases) rather than B10 (cash after advances).
- Decisions B37 contains a cached `#VALUE!`; direct application checks replace it.
- Spring–autumn decisions remain placeholders. The apparent annual −14,700 net result is not an actual year-end figure and is not used as the Year 1 annual profit.

The independent fictional example from rules section 11 and workbook Demonstration is also tested: profit before tax/net loss −3,560; closing cash 71,940; tax-loss carryforward 3,560. Every difference is zero. It is never presented as the team's winter result.

## Verification

The 22 automated tests cover historical replay, the independent example, all advance and closing cash checks, same-season loan repayment and interest, term limits, excess repayments, tax-loss offsets, negative profit and bonus, no double-counted spoilage, unused milk, idle/expired machines, capacity and premises, proportional transport, allocation blocks, invalid input handling, financial reconciliation and isolation of annual profit and historical data.

Local browser tests verify two independent scenarios, reactive calculations, reload persistence, reset confirmation and restoration. A positive opening balance of 120,000 clears the initial numeric constraints; reducing Conservative allocated sales to 20,000 changes its profit to −36,800 and closing cash to 58,700 without changing Growth. Reset restores zero balances and the shortfall warnings.

Owned-machine and outstanding-loan controls were tested in the browser, as were negative inputs and a cleared required minimum-marketing field. A 390px local iframe check rendered a 375px content viewport without horizontal page overflow. The optional read-only WebMCP tool returned the same results and rejected unexpected arguments. No live Vercel test was possible before authentication.

## GitHub and Vercel deployment

The project can be published from the repository root. Verify the production URL after deployment before submitting it.

1. Sign in to GitHub and create a repository named `pork-garlic-year2-calculator`. Upload the contents of this directory at the repository root, preserving `public/`, `tests/` and `scripts/`. Do not upload the ZIP as the application's source. A private repository is fine if the assignment reviewer has access; otherwise choose the visibility required by your course.
2. Sign in to Vercel and choose **Add New → Project**. Import the GitHub repository and authorize access to that repository if needed.
3. Use framework preset **Other**, root directory `./`, build command `node scripts/check.mjs`, and output directory `public`. The supplied `vercel.json` declares these settings. No environment variables or paid services are required.
4. Deploy. Open the exact production URL Vercel returns, confirm the calculator loads, change opening cash and actual sales, reload to verify persistence, and test Reset. Check Year 1 validation shows zero arithmetic differences and the source-data warning.
5. Submit the repository URL and the verified Vercel production URL in your own class spreadsheet row. This project does not edit the submission sheet.

The Vercel deployment is static; it does not run `server.mjs`. That server is only for local development. All application inputs remain in `localStorage` on the current browser and origin; they do not transfer automatically between localhost and a deployed URL. Reset affects only this calculator's local data.

## Files

- `public/model.mjs`: pure calculations, defaults and frozen validation fixtures.
- `public/app.mjs`: controls, rendering, local persistence and optional read-only WebMCP tool.
- `public/index.html`, `public/styles.css`: accessible responsive interface.
- `tests/model.test.mjs`: meaningful financial tests, without dependencies.
- `scripts/check.mjs`: syntax, asset and test build gate.
- `server.mjs`: local-only HTTP server.
- `vercel.json`: static deployment configuration.

The optional `read_strategy_comparison` WebMCP tool is feature-detected and does not change state. Ordinary browsers need no extension or model integration to use the calculator.
