/* GAS Agent — Pro workspace: job models (roles), role tools and the Overview home.
   Loaded before app.js; app.js calls GASPro.init(api) with its shared helpers. */
(() => {
  'use strict';

  /* ---------------- Number helpers ---------------- */
  const fin = (n) => (Number.isFinite(n) ? n : 0);
  const peso = (n) => (fin(n) < 0 ? '−₱' : '₱') + Math.abs(fin(n)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n, d = 0) => fin(n).toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (n, d = 1) => `${fin(n).toFixed(d)}%`;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const longDate = (d) => d.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  // Philippine income tax, graduated rates for 2023 onward (TRAIN law), annual taxable income.
  const BRACKETS = [
    [0, 250000, 0, 0], [250000, 400000, 0, .15], [400000, 800000, 22500, .20],
    [800000, 2000000, 102500, .25], [2000000, 8000000, 402500, .30], [8000000, Infinity, 2202500, .35],
  ];
  const incomeTax = (t) => { const b = BRACKETS.find(([lo, hi]) => t > lo && t <= hi) || BRACKETS[0]; return t <= 250000 ? 0 : b[2] + (t - b[0]) * b[3]; };
  const bracketOf = (t) => BRACKETS.findIndex(([lo, hi]) => (t <= 250000 ? lo === 0 : t > lo && t <= hi));

  /* ---------------- Tools ----------------
     Each tool lists its fields and a calc(values) that returns
     { stats: [{ l, v, tone }], table: { head, rows }, pre, note }.
     The text for Copy / Ask AI / Save is built from the same output. */
  const T = {
    vat: {
      name: 'VAT calculator', ico: 'receipt', desc: 'Add or remove VAT from any amount.',
      fields: [
        { k: 'amount', label: 'Amount', type: 'number', value: 112000, prefix: '₱' },
        { k: 'mode', label: 'The amount', type: 'select', value: 'Includes VAT', options: ['Includes VAT', 'Excludes VAT'] },
        { k: 'rate', label: 'VAT rate', type: 'number', value: 12, suffix: '%', step: .5 },
      ],
      calc(v) {
        const r = v.rate / 100; const incl = v.mode === 'Includes VAT';
        const net = incl ? v.amount / (1 + r) : v.amount; const vat = net * r; const gross = net + vat;
        return { say: `${peso(net)} plus ${pct(v.rate, 0)} VAT (${peso(vat)}) makes ${peso(gross)}.`, stats: [{ l: 'Net of VAT', v: peso(net) }, { l: `VAT (${pct(v.rate, 1)})`, v: peso(vat), tone: 'accent' }, { l: 'Gross amount', v: peso(gross) }],
          note: incl ? 'VAT = amount × rate ÷ (1 + rate).' : 'VAT = amount × rate.' };
      },
    },
    depreciation: {
      name: 'Depreciation schedule', ico: 'bars', desc: 'Straight-line or double-declining balance.',
      fields: [
        { k: 'cost', label: 'Asset cost', type: 'number', value: 500000, prefix: '₱' },
        { k: 'salvage', label: 'Salvage value', type: 'number', value: 50000, prefix: '₱' },
        { k: 'life', label: 'Useful life', type: 'number', value: 5, suffix: 'years', min: 1, max: 40 },
        { k: 'method', label: 'Method', type: 'select', value: 'Straight-line', options: ['Straight-line', 'Double-declining balance'] },
      ],
      calc(v) {
        const life = clamp(Math.round(v.life) || 1, 1, 40); const base = Math.max(0, v.cost - v.salvage);
        let bv = v.cost, acc = 0; const rows = [];
        for (let y = 1; y <= life; y++) {
          let d = v.method === 'Straight-line' ? base / life : Math.min(bv * (2 / life), Math.max(0, bv - v.salvage));
          if (y === life) d = Math.max(0, bv - v.salvage);
          acc += d; bv -= d; rows.push([`Year ${y}`, peso(d), peso(acc), peso(bv)]);
        }
        return { say: `The asset loses ${rows[0][1]} in value in year 1 and is worth ${peso(bv)} after ${life} year${life === 1 ? '' : 's'}.`, stats: [{ l: 'Year 1 depreciation', v: rows[0][1], tone: 'accent' }, { l: 'Depreciable base', v: peso(base) }, { l: 'Ending book value', v: peso(bv) }],
          table: { head: ['Year', 'Depreciation', 'Accumulated', 'Book value'], rows } };
      },
    },
    incomeTax: {
      name: 'Income tax estimator', ico: 'receipt', desc: 'Annual income tax under the TRAIN law (2023 onward).',
      fields: [
        { k: 'type', label: 'Taxpayer', type: 'select', value: 'Employee', options: ['Employee', 'Self-employed / professional'] },
        { k: 'income', label: 'Gross annual income', type: 'number', value: 900000, prefix: '₱' },
        { k: 'deduct', label: 'Exclusions or deductions', type: 'number', value: 60000, prefix: '₱', hint: 'Employees: mandatory contributions and non-taxable pay. Self-employed: business expenses.' },
        { k: 'option', label: 'Tax option', type: 'select', value: 'Graduated rates', options: ['Graduated rates', '8% flat rate'] },
      ],
      calc(v) {
        const flat = v.option === '8% flat rate' && v.type !== 'Employee';
        const taxable = flat ? Math.max(0, v.income - 250000) : Math.max(0, v.income - v.deduct);
        const tax = flat ? taxable * .08 : incomeTax(taxable);
        const bi = bracketOf(taxable);
        return {
          say: tax ? `You owe about ${peso(tax)} in income tax a year, around ${peso(tax / 12)} a month.` : 'No income tax is due: taxable income is ₱250,000 or less.',
          stats: [{ l: flat ? 'Base (gross − ₱250,000)' : 'Taxable income', v: peso(taxable) }, { l: 'Income tax due', v: peso(tax), tone: 'accent' }, { l: 'Effective rate', v: pct(v.income ? (tax / v.income) * 100 : 0) }, { l: 'Monthly equivalent', v: peso(tax / 12) }],
          table: flat ? null : { head: ['Annual taxable income', 'Tax', ''], rows: BRACKETS.map(([lo, hi, base, r], i) => [`${hi === Infinity ? 'Over ' + peso(lo) : (lo ? peso(lo) + ' – ' : 'Up to ') + peso(hi)}`, r ? `${base ? peso(base) + ' + ' : ''}${r * 100}% of excess over ${peso(lo)}` : 'Exempt', i === bi ? 'Your bracket' : '']) },
          note: v.option === '8% flat rate' && v.type === 'Employee' ? 'The 8% option is only for self-employed individuals and professionals, so graduated rates are used.' : 'Estimate only. Confirm with the BIR or your accountant before filing.',
        };
      },
    },
    payroll: {
      name: 'Payroll withholding', ico: 'wallet', desc: 'Monthly SSS, PhilHealth, Pag-IBIG, tax and take-home pay.',
      fields: [
        { k: 'salary', label: 'Monthly basic salary', type: 'number', value: 35000, prefix: '₱' },
        { k: 'other', label: 'Other taxable pay', type: 'number', value: 0, prefix: '₱' },
        { k: 'nontax', label: 'Non-taxable allowances', type: 'number', value: 2000, prefix: '₱' },
      ],
      calc(v) {
        const msc = clamp(Math.round(v.salary / 500) * 500, 5000, 35000);
        const sss = msc * .05; const ph = clamp(v.salary, 10000, 100000) * .025;
        const pi = Math.min(v.salary, 10000) * (v.salary <= 1500 ? .01 : .02);
        const contrib = sss + ph + pi; const taxable = Math.max(0, v.salary + v.other - contrib);
        const tax = incomeTax(taxable * 12) / 12; const net = v.salary + v.other + v.nontax - contrib - tax;
        return {
          say: `From a ${peso(v.salary)} salary, the employee takes home about ${peso(net)} after contributions and tax.`,
          stats: [{ l: 'Withholding tax', v: peso(tax), tone: 'accent' }, { l: 'Contributions', v: peso(contrib) }, { l: 'Net take-home pay', v: peso(net), tone: 'good' }],
          table: { head: ['Item', 'Amount'], rows: [['Basic salary', peso(v.salary)], ['Other taxable pay', peso(v.other)], ['Non-taxable allowances', peso(v.nontax)], [`SSS (5% of ₱${num(msc)} MSC)`, '−' + peso(sss)], ['PhilHealth (2.5% employee share)', '−' + peso(ph)], ['Pag-IBIG', '−' + peso(pi)], ['Taxable compensation', peso(taxable)], ['Withholding tax', '−' + peso(tax)], ['Net pay', peso(net)]] },
          note: 'Uses 2025 employee rates (SSS 5% of MSC ₱5,000–₱35,000, PhilHealth 5% split, Pag-IBIG 2% up to ₱10,000). Check the latest official tables.',
        };
      },
    },
    loan: {
      name: 'Loan amortization', ico: 'calc', desc: 'Monthly payment, interest and yearly balance.',
      fields: [
        { k: 'principal', label: 'Loan amount', type: 'number', value: 1000000, prefix: '₱' },
        { k: 'rate', label: 'Annual interest rate', type: 'number', value: 9, suffix: '%', step: .25 },
        { k: 'months', label: 'Term', type: 'number', value: 36, suffix: 'months', min: 1, max: 480 },
      ],
      calc(v) {
        const n = clamp(Math.round(v.months) || 1, 1, 480); const r = v.rate / 1200;
        const pay = r ? (v.principal * r) / (1 - Math.pow(1 + r, -n)) : v.principal / n;
        let bal = v.principal; const rows = []; let yp = 0, yi = 0;
        for (let m = 1; m <= n; m++) {
          const int = bal * r; const prin = pay - int; bal = Math.max(0, bal - prin); yp += prin; yi += int;
          if (m % 12 === 0 || m === n) { rows.push([`Year ${Math.ceil(m / 12)}`, peso(yp), peso(yi), peso(bal)]); yp = 0; yi = 0; }
        }
        return { say: `You will pay ${peso(pay)} a month for ${n} months, with ${peso(pay * n - v.principal)} of interest in total.`, stats: [{ l: 'Monthly payment', v: peso(pay), tone: 'accent' }, { l: 'Total interest', v: peso(pay * n - v.principal) }, { l: 'Total paid', v: peso(pay * n) }],
          table: { head: ['Period', 'Principal paid', 'Interest paid', 'Ending balance'], rows } };
      },
    },
    npv: {
      name: 'NPV & IRR', ico: 'trend', desc: 'Evaluate an investment from its cash flows.',
      fields: [
        { k: 'rate', label: 'Discount rate', type: 'number', value: 10, suffix: '%', step: .5 },
        { k: 'invest', label: 'Initial investment', type: 'number', value: 500000, prefix: '₱' },
        { k: 'flows', label: 'Yearly cash flows (comma-separated)', type: 'text', value: '150000, 180000, 200000, 220000', wide: true },
      ],
      calc(v) {
        const cf = String(v.flows).split(/[,;\s]+/).map((x) => parseFloat(x.replace(/[^\d.-]/g, ''))).filter(Number.isFinite).slice(0, 40);
        const flows = [-Math.abs(v.invest), ...cf]; const npvAt = (r) => flows.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
        const npv = npvAt(v.rate / 100);
        let irr = null, lo = -.99, hi = 10;
        if (npvAt(lo) * npvAt(hi) < 0) { for (let i = 0; i < 120; i++) { const mid = (lo + hi) / 2; if (npvAt(lo) * npvAt(mid) <= 0) hi = mid; else lo = mid; } irr = (lo + hi) / 2; }
        let cum = 0, pay = null; const rows = flows.map((c, t) => {
          const prev = cum; cum += c; if (pay === null && t > 0 && cum >= 0) pay = t - 1 + (c ? -prev / c : 0);
          return [`Year ${t}`, peso(c), peso(c / Math.pow(1 + v.rate / 100, t)), peso(cum)];
        });
        return {
          say: npv >= 0 ? `Good investment: it beats your ${pct(v.rate, 0)} target by ${peso(npv)} in today's money${pay === null ? '' : ` and pays for itself in ${pay.toFixed(1)} years`}.` : `This investment falls short of your ${pct(v.rate, 0)} target by ${peso(-npv)} in today's money.`,
          stats: [{ l: 'Net present value', v: peso(npv), tone: npv >= 0 ? 'good' : 'bad' }, { l: 'IRR', v: irr === null ? 'n/a' : pct(irr * 100) }, { l: 'Payback', v: pay === null ? 'Not reached' : `${pay.toFixed(1)} years` }],
          table: { head: ['Period', 'Cash flow', 'Discounted', 'Cumulative'], rows },
          note: npv >= 0 ? 'Positive NPV: the project earns more than the discount rate.' : 'Negative NPV: the project earns less than the discount rate.',
        };
      },
    },
    deadline: {
      name: 'Deadline calculator', ico: 'calendar', desc: 'Count filing and contract deadlines.',
      fields: [
        { k: 'start', label: 'Start date (notice or receipt)', type: 'date', value: 'today' },
        { k: 'days', label: 'Period', type: 'number', value: 15, suffix: 'days', min: 1, max: 3650 },
        { k: 'count', label: 'Count', type: 'select', value: 'Calendar days', options: ['Calendar days', 'Business days (Mon–Fri)'] },
        { k: 'roll', label: 'If it ends on a weekend', type: 'select', value: 'Move to next business day', options: ['Move to next business day', 'Keep the date'] },
      ],
      calc(v) {
        const [y, m, d] = String(v.start).split('-').map(Number); const start = y ? new Date(y, m - 1, d) : new Date();
        const days = clamp(Math.round(v.days) || 1, 1, 3650); const biz = v.count !== 'Calendar days';
        const add = (n) => { const x = new Date(start); let left = n; while (left > 0) { x.setDate(x.getDate() + 1); if (!biz || (x.getDay() % 6)) left--; } return x; };
        let due = add(days); let moved = false;
        if (v.roll === 'Move to next business day') while (!(due.getDay() % 6)) { due.setDate(due.getDate() + 1); moved = true; }
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const left = Math.round((due - today) / 864e5);
        const mile = (f) => longDate(add(Math.max(1, Math.round(days * f))));
        return {
          say: `Your deadline is ${longDate(due)}${left >= 0 ? `, ${left} day${left === 1 ? '' : 's'} from today` : `, which was ${-left} days ago`}.`,
          stats: [{ l: 'Deadline', v: longDate(due), tone: 'accent' }, { l: 'From today', v: left >= 0 ? `${left} day${left === 1 ? '' : 's'} left` : `${-left} days ago`, tone: left < 0 ? 'bad' : left <= 3 ? 'bad' : 'good' }],
          table: { head: ['Milestone', 'Date'], rows: [['Start (day 0, not counted)', longDate(start)], ['Halfway', mile(.5)], ['Draft ready (75%)', mile(.75)], ['Deadline', longDate(due) + (moved ? ' (moved off weekend)' : '')]] },
          note: 'Counts exclude the first day and include the last. Holidays are not included: check the official holiday list and move the date if needed.',
        };
      },
    },
    clauses: {
      name: 'Contract clause check', ico: 'clipboard', desc: 'See which standard clauses are missing.',
      fields: [
        { k: 'type', label: 'Contract type', type: 'select', value: 'Service agreement', options: ['Service agreement', 'Employment contract', 'Non-disclosure agreement', 'Lease agreement', 'Supply agreement'] },
        { k: 'have', label: 'Clauses already in the draft', type: 'checks', wide: true, value: ['Parties and recitals', 'Scope of work', 'Payment terms', 'Signatures'],
          options: ['Parties and recitals', 'Scope of work', 'Term and renewal', 'Payment terms', 'Confidentiality', 'Intellectual property', 'Liability and indemnity', 'Termination', 'Governing law and disputes', 'Force majeure', 'Data privacy (RA 10173)', 'Signatures'] },
      ],
      calc(v, f) {
        const all = f.find((x) => x.k === 'have').options; const have = all.filter((o) => v.have.includes(o)); const miss = all.filter((o) => !v.have.includes(o));
        const cov = (have.length / all.length) * 100;
        return {
          say: miss.length ? `Your draft has ${have.length} of ${all.length} standard clauses. ${miss.length} ${miss.length === 1 ? 'is' : 'are'} missing.` : 'Your draft has all the standard clauses.',
          stats: [{ l: 'Coverage', v: pct(cov, 0), tone: cov >= 80 ? 'good' : cov < 50 ? 'bad' : 'accent' }, { l: 'Missing clauses', v: String(miss.length) }, { l: 'Risk', v: cov >= 80 ? 'Low' : cov >= 50 ? 'Medium' : 'High', tone: cov >= 80 ? 'good' : cov < 50 ? 'bad' : 'accent' }],
          table: miss.length ? { head: ['Missing from your ' + v.type.toLowerCase()], rows: miss.map((x) => [x]) } : null,
          note: miss.length ? 'Ask the Legal Assistant to draft the missing clauses in plain language.' : 'All standard clauses are covered. Have a lawyer review the final draft.',
          ask: miss.length ? `Draft the missing clauses for my ${v.type.toLowerCase()} under Philippine law: ${miss.join(', ')}. Use clear, plain language and number each clause.` : null,
        };
      },
    },
    roas: {
      name: 'Campaign ROI', ico: 'pie', desc: 'ROAS, CPA, CTR and the rest from your ad numbers.',
      fields: [
        { k: 'spend', label: 'Ad spend', type: 'number', value: 50000, prefix: '₱' },
        { k: 'revenue', label: 'Revenue from the campaign', type: 'number', value: 180000, prefix: '₱' },
        { k: 'impr', label: 'Impressions', type: 'number', value: 400000 },
        { k: 'clicks', label: 'Clicks', type: 'number', value: 8000 },
        { k: 'conv', label: 'Conversions', type: 'number', value: 240 },
      ],
      calc(v) {
        const d = (a, b) => (b ? a / b : 0);
        const roas = d(v.revenue, v.spend); const roi = d(v.revenue - v.spend, v.spend) * 100;
        return {
          say: `Every ₱1 spent on ads brought back ₱${roas.toFixed(2)}. Each sale cost ${peso(d(v.spend, v.conv))} in ads.`,
          stats: [{ l: 'ROAS', v: `${roas.toFixed(2)}×`, tone: roas >= 3 ? 'good' : roas < 1 ? 'bad' : 'accent' }, { l: 'ROI', v: pct(roi), tone: roi >= 0 ? 'good' : 'bad' }, { l: 'Cost per acquisition', v: peso(d(v.spend, v.conv)) }, { l: 'Click-through rate', v: pct(d(v.clicks, v.impr) * 100, 2) }],
          table: { head: ['Metric', 'Value'], rows: [['Cost per click (CPC)', peso(d(v.spend, v.clicks))], ['Cost per 1,000 impressions (CPM)', peso(d(v.spend, v.impr) * 1000)], ['Conversion rate', pct(d(v.conv, v.clicks) * 100, 2)], ['Revenue per conversion', peso(d(v.revenue, v.conv))], ['Profit after ad spend', peso(v.revenue - v.spend)]] },
        };
      },
    },
    utm: {
      name: 'UTM link builder', ico: 'link', desc: 'Tracked links for every channel.',
      fields: [
        { k: 'url', label: 'Page URL', type: 'text', value: 'https://example.com/shop', wide: true },
        { k: 'source', label: 'Source', type: 'text', value: 'facebook' },
        { k: 'medium', label: 'Medium', type: 'text', value: 'paid_social' },
        { k: 'campaign', label: 'Campaign', type: 'text', value: 'olive_glow_launch' },
        { k: 'content', label: 'Content (optional)', type: 'text', value: 'carousel_a' },
      ],
      calc(v) {
        let link = '';
        try {
          const u = new URL(/^https?:\/\//i.test(v.url) ? v.url : 'https://' + v.url);
          [['utm_source', v.source], ['utm_medium', v.medium], ['utm_campaign', v.campaign], ['utm_content', v.content]].forEach(([k, x]) => { const s = String(x || '').trim().toLowerCase().replace(/\s+/g, '_'); if (s) u.searchParams.set(k, s); });
          link = u.toString();
        } catch { return { say: 'Enter a valid web address, such as https://example.com.', stats: [{ l: 'Link', v: 'Enter a valid URL', tone: 'bad' }] }; }
        const missing = ['source', 'medium', 'campaign'].filter((k) => !String(v[k] || '').trim());
        return { say: missing.length ? `Add a ${missing.join(' and ')} to finish the link.` : 'Your tracked link is ready to copy.', stats: [{ l: 'Status', v: missing.length ? `Add ${missing.join(', ')}` : 'Ready to share', tone: missing.length ? 'bad' : 'good' }, { l: 'Length', v: `${link.length} chars` }], pre: link, copyText: link, note: 'Values are lower-cased and spaces become underscores so reports group cleanly.' };
      },
    },
    commission: {
      name: 'Commission calculator', ico: 'wallet', desc: 'Earnings with an accelerator above quota.',
      fields: [
        { k: 'sales', label: 'Sales closed', type: 'number', value: 1200000, prefix: '₱' },
        { k: 'quota', label: 'Quota', type: 'number', value: 1000000, prefix: '₱' },
        { k: 'base', label: 'Rate up to quota', type: 'number', value: 5, suffix: '%', step: .5 },
        { k: 'acc', label: 'Rate above quota', type: 'number', value: 8, suffix: '%', step: .5 },
        { k: 'salary', label: 'Base salary', type: 'number', value: 25000, prefix: '₱' },
      ],
      calc(v) {
        const att = v.quota ? (v.sales / v.quota) * 100 : 0; const t1 = Math.min(v.sales, v.quota) * v.base / 100; const t2 = Math.max(0, v.sales - v.quota) * v.acc / 100;
        return {
          say: `You reached ${pct(att, 0)} of quota and earned ${peso(t1 + t2)} in commission (${peso(v.salary + t1 + t2)} with base salary).`,
          stats: [{ l: 'Quota attainment', v: pct(att, 0), tone: att >= 100 ? 'good' : att < 70 ? 'bad' : 'accent' }, { l: 'Commission', v: peso(t1 + t2), tone: 'accent' }, { l: 'Total earnings', v: peso(v.salary + t1 + t2) }],
          table: { head: ['Tier', 'Sales', 'Rate', 'Commission'], rows: [['Up to quota', peso(Math.min(v.sales, v.quota)), pct(v.base), peso(t1)], ['Above quota', peso(Math.max(0, v.sales - v.quota)), pct(v.acc), peso(t2)]] },
        };
      },
    },
    pipeline: {
      name: 'Pipeline forecast', ico: 'trend', desc: 'Weighted forecast against your target.',
      fields: [
        { k: 'target', label: 'Target this period', type: 'number', value: 1000000, prefix: '₱', wide: true },
        { k: 'pros', label: 'Prospecting (10%)', type: 'number', value: 800000, prefix: '₱' },
        { k: 'qual', label: 'Qualified (25%)', type: 'number', value: 600000, prefix: '₱' },
        { k: 'prop', label: 'Proposal (50%)', type: 'number', value: 450000, prefix: '₱' },
        { k: 'nego', label: 'Negotiation (75%)', type: 'number', value: 300000, prefix: '₱' },
        { k: 'commit', label: 'Verbal commit (90%)', type: 'number', value: 200000, prefix: '₱' },
      ],
      calc(v) {
        const st = [['Prospecting', v.pros, .1], ['Qualified', v.qual, .25], ['Proposal', v.prop, .5], ['Negotiation', v.nego, .75], ['Verbal commit', v.commit, .9]];
        const total = st.reduce((s, x) => s + x[1], 0); const w = st.reduce((s, x) => s + x[1] * x[2], 0); const gap = v.target - w;
        return {
          say: gap > 0 ? `Expect about ${peso(w)} this period, ${peso(gap)} short of the target.` : `Expect about ${peso(w)} this period, ${peso(-gap)} above the target.`,
          stats: [{ l: 'Weighted forecast', v: peso(w), tone: 'accent' }, { l: 'Pipeline coverage', v: `${(v.target ? total / v.target : 0).toFixed(1)}×`, tone: total >= v.target * 3 ? 'good' : 'bad' }, { l: gap > 0 ? 'Gap to target' : 'Above target', v: peso(Math.abs(gap)), tone: gap > 0 ? 'bad' : 'good' }],
          table: { head: ['Stage', 'Pipeline', 'Probability', 'Weighted'], rows: st.map(([n, x, p]) => [n, peso(x), pct(p * 100, 0), peso(x * p)]) },
          note: 'A healthy pipeline is usually about 3× the target.',
        };
      },
    },
    overtime: {
      name: 'Overtime & premium pay', ico: 'clock', desc: 'Labor Code premiums from a monthly rate.',
      fields: [
        { k: 'monthly', label: 'Monthly rate', type: 'number', value: 25000, prefix: '₱' },
        { k: 'days', label: 'Work days per year', type: 'select', value: '261 (5-day week)', options: ['261 (5-day week)', '313 (6-day week)'] },
        { k: 'ot', label: 'Regular overtime', type: 'number', value: 10, suffix: 'hours' },
        { k: 'rest', label: 'Rest day or special day', type: 'number', value: 8, suffix: 'hours' },
        { k: 'hol', label: 'Regular holiday', type: 'number', value: 0, suffix: 'hours' },
        { k: 'night', label: 'Night shift (10 pm–6 am)', type: 'number', value: 0, suffix: 'hours' },
      ],
      calc(v) {
        const daily = (v.monthly * 12) / parseInt(v.days, 10); const hr = daily / 8;
        const items = [['Regular overtime', v.ot, 1.25], ['Rest day or special day', v.rest, 1.3], ['Regular holiday', v.hol, 2], ['Night shift differential', v.night, .1]];
        const total = items.reduce((s, [, h, m]) => s + h * hr * m, 0);
        return {
          say: `These hours add ${peso(total)} to the pay, based on an hourly rate of ${peso(hr)}.`,
          stats: [{ l: 'Daily rate', v: peso(daily) }, { l: 'Hourly rate', v: peso(hr) }, { l: 'Total premium pay', v: peso(total), tone: 'accent' }],
          table: { head: ['Type', 'Hours', 'Rate', 'Amount'], rows: items.map(([n, h, m]) => [n, num(h, 1), m === .1 ? '+10%' : `${Math.round(m * 100)}%`, peso(h * hr * m)]) },
          note: 'Uses basic Labor Code rates. Combined cases (for example overtime on a holiday) have higher rates.',
        };
      },
    },
    thirteenth: {
      name: '13th month pay', ico: 'calendar', desc: 'Amount due and the taxable part.',
      fields: [
        { k: 'salary', label: 'Monthly basic salary', type: 'number', value: 25000, prefix: '₱' },
        { k: 'months', label: 'Months worked this year', type: 'number', value: 12, min: 0, max: 12, step: .5 },
        { k: 'unpaid', label: 'Unpaid absences (total)', type: 'number', value: 0, prefix: '₱' },
        { k: 'other', label: 'Other bonuses this year', type: 'number', value: 0, prefix: '₱' },
      ],
      calc(v) {
        const basic = Math.max(0, v.salary * clamp(v.months, 0, 12) - v.unpaid); const pay = basic / 12;
        const taxable = Math.max(0, pay + v.other - 90000);
        return {
          say: `Pay ${peso(pay)} on or before 24 December${taxable ? `; ${peso(taxable)} of it is taxable` : ', all of it tax-free'}.`,
          stats: [{ l: '13th month pay', v: peso(pay), tone: 'accent' }, { l: 'Tax-exempt part', v: peso(pay + v.other - taxable) }, { l: 'Taxable excess', v: peso(taxable), tone: taxable ? 'bad' : 'good' }],
          table: { head: ['Step', 'Amount'], rows: [['Basic salary earned this year', peso(basic)], ['÷ 12 = 13th month pay', peso(pay)], ['Plus other bonuses', peso(v.other)], ['Exempt ceiling (13th month + other benefits)', peso(90000)]] },
          note: 'Due on or before 24 December. Basic salary excludes allowances and overtime.',
        };
      },
    },
    eoq: {
      name: 'Reorder point & EOQ', ico: 'box', desc: 'How much to order and when.',
      fields: [
        { k: 'demand', label: 'Annual demand', type: 'number', value: 12000, suffix: 'units' },
        { k: 'order', label: 'Cost per order', type: 'number', value: 1500, prefix: '₱' },
        { k: 'hold', label: 'Holding cost per unit / year', type: 'number', value: 25, prefix: '₱' },
        { k: 'lead', label: 'Supplier lead time', type: 'number', value: 7, suffix: 'days' },
        { k: 'safety', label: 'Safety stock', type: 'number', value: 3, suffix: 'days' },
        { k: 'wd', label: 'Working days per year', type: 'number', value: 300, suffix: 'days' },
      ],
      calc(v) {
        const eoq = v.hold > 0 ? Math.sqrt((2 * v.demand * v.order) / v.hold) : 0; const daily = v.wd ? v.demand / v.wd : 0;
        const rop = daily * (v.lead + v.safety); const orders = eoq ? v.demand / eoq : 0; const cost = orders * v.order + (eoq / 2) * v.hold;
        return {
          say: `Order about ${num(Math.round(eoq))} units at a time, and reorder when stock drops to ${num(Math.ceil(rop))} units.`,
          stats: [{ l: 'Order quantity (EOQ)', v: `${num(Math.round(eoq))} units`, tone: 'accent' }, { l: 'Reorder point', v: `${num(Math.ceil(rop))} units`, tone: 'accent' }, { l: 'Orders per year', v: num(orders, 1) }, { l: 'Annual order + holding cost', v: peso(cost) }],
          table: { head: ['Detail', 'Value'], rows: [['Average daily usage', `${num(daily, 1)} units`], ['Safety stock', `${num(Math.ceil(daily * v.safety))} units`], ['Days between orders', orders ? num(v.wd / orders, 1) : 'n/a']] },
          note: 'Reorder when stock on hand falls to the reorder point.',
        };
      },
    },
    oee: {
      name: 'OEE calculator', ico: 'gauge', desc: 'Availability × performance × quality.',
      fields: [
        { k: 'planned', label: 'Planned production time', type: 'number', value: 480, suffix: 'min' },
        { k: 'down', label: 'Downtime', type: 'number', value: 45, suffix: 'min' },
        { k: 'cycle', label: 'Ideal cycle time', type: 'number', value: 30, suffix: 'sec / unit' },
        { k: 'total', label: 'Total units made', type: 'number', value: 780 },
        { k: 'good', label: 'Good units', type: 'number', value: 750 },
      ],
      calc(v) {
        const run = Math.max(0, v.planned - v.down); const a = v.planned ? run / v.planned : 0; const p = run ? Math.min(1.5, (v.cycle * v.total) / 60 / run) : 0; const q = v.total ? v.good / v.total : 0;
        const oee = a * p * q * 100;
        return {
          say: `The line runs at ${pct(oee)} of its full potential. ${[['Availability', a], ['Performance', p], ['Quality', q]].sort((m, n) => m[1] - n[1])[0][0]} is the biggest loss.`,
          stats: [{ l: 'OEE', v: pct(oee), tone: oee >= 85 ? 'good' : oee < 60 ? 'bad' : 'accent' }, { l: 'Availability', v: pct(a * 100) }, { l: 'Performance', v: pct(p * 100) }, { l: 'Quality', v: pct(q * 100) }],
          note: oee >= 85 ? 'World-class level (85% or more).' : oee >= 60 ? 'Typical range. The lowest of the three factors is the place to start.' : 'Below 60%: large room for improvement.',
        };
      },
    },
    json: {
      name: 'JSON formatter', ico: 'code', desc: 'Validate, pretty-print or minify JSON.',
      fields: [
        { k: 'src', label: 'JSON', type: 'textarea', wide: true, value: '{"invoice":"INV-1042","customer":{"name":"Kape Co.","tin":"123-456-789"},"items":[{"sku":"BEAN-1","qty":4,"price":450}],"paid":false}' },
        { k: 'indent', label: 'Output', type: 'select', value: '2 spaces', options: ['2 spaces', '4 spaces', 'Minify'] },
      ],
      calc(v) {
        try {
          const o = JSON.parse(v.src); let keys = 0;
          const depth = (x) => (x && typeof x === 'object' ? (keys += Array.isArray(x) ? 0 : Object.keys(x).length, 1 + Math.max(0, ...Object.values(x).map(depth))) : 0);
          const dp = depth(o); const out = JSON.stringify(o, null, v.indent === 'Minify' ? 0 : v.indent === '4 spaces' ? 4 : 2);
          return { say: 'Your JSON is valid.', stats: [{ l: 'Status', v: 'Valid JSON', tone: 'good' }, { l: 'Keys', v: num(keys) }, { l: 'Depth', v: String(dp) }, { l: 'Size', v: `${num(new Blob([out]).size)} bytes` }], pre: out, copyText: out };
        } catch (e) { return { say: 'There is a problem in your JSON. See the message below.', stats: [{ l: 'Status', v: 'Invalid JSON', tone: 'bad' }], note: e.message }; }
      },
    },
    regex: {
      name: 'Regex tester', ico: 'search', desc: 'Test a pattern against sample text.',
      fields: [
        { k: 'pattern', label: 'Pattern', type: 'text', value: '[\\w.+-]+@[\\w-]+\\.[\\w.]+' },
        { k: 'flags', label: 'Flags', type: 'text', value: 'gi' },
        { k: 'text', label: 'Test text', type: 'textarea', wide: true, value: 'Send the report to ana@kape.co and copy jon.reyes@example.ph.\nOld address: sales(at)example.com' },
      ],
      calc(v) {
        let re; try { re = new RegExp(v.pattern, String(v.flags).replace(/[^dgimsuvy]/g, '').replace(/(.)(?=.*\1)/g, '').replace('g', '') + 'g'); }
        catch (e) { return { say: 'The pattern has an error. See the message below.', stats: [{ l: 'Status', v: 'Invalid pattern', tone: 'bad' }], note: e.message }; }
        const ms = Array.from(String(v.text).matchAll(re)).slice(0, 200);
        return {
          say: ms.length ? `Found ${ms.length} match${ms.length === 1 ? '' : 'es'} in your text.` : 'No matches in your text.',
          stats: [{ l: 'Matches', v: String(ms.length), tone: ms.length ? 'good' : 'bad' }, { l: 'Pattern', v: `/${v.pattern}/${re.flags}` }],
          table: ms.length ? { head: ['#', 'Match', 'Index', 'Groups'], rows: ms.map((m, i) => [String(i + 1), m[0] || '(empty)', String(m.index), m.length > 1 ? m.slice(1).map((g) => g ?? '∅').join(', ') : '']) } : null,
        };
      },
    },
    fertilizer: {
      name: 'Fertilizer calculator', ico: 'droplet', desc: 'Bags of 14-14-14, urea and potash for your target.',
      fields: [
        { k: 'area', label: 'Area', type: 'number', value: 2, suffix: 'ha', step: .1 },
        { k: 'n', label: 'Target N', type: 'number', value: 90, suffix: 'kg/ha' },
        { k: 'p', label: 'Target P₂O₅', type: 'number', value: 30, suffix: 'kg/ha' },
        { k: 'k', label: 'Target K₂O', type: 'number', value: 45, suffix: 'kg/ha' },
        { k: 'bag', label: 'Bag size', type: 'number', value: 50, suffix: 'kg' },
      ],
      calc(v) {
        const comp = v.p / .14; const kLeft = Math.max(0, v.k - comp * .14); const nLeft = Math.max(0, v.n - comp * .14);
        const mop = kLeft / .6; const urea = nLeft / .46; const bag = v.bag || 50;
        const rows = [['Complete 14-14-14', comp], ['Urea 46-0-0', urea], ['Muriate of potash 0-0-60', mop]].map(([n, kg]) => [n, num(kg, 1), num(kg * v.area, 1), num((kg * v.area) / bag, 1)]);
        const bags = ((comp + urea + mop) * v.area) / bag;
        return {
          say: `For ${num(v.area, 1)} ha, buy about ${rows[0][3]} bags of 14-14-14, ${rows[1][3]} bags of urea and ${rows[2][3]} bags of potash.`,
          stats: [{ l: '14-14-14', v: `${rows[0][3]} bags`, tone: 'accent' }, { l: 'Urea', v: `${rows[1][3]} bags`, tone: 'accent' }, { l: 'Potash', v: `${rows[2][3]} bags` }, { l: 'Total', v: `${num(bags, 1)} bags` }],
          table: { head: ['Fertilizer', 'kg / ha', 'Total kg', `${bag}-kg bags`], rows },
          note: 'Supplies phosphorus with 14-14-14, then tops up N with urea and K with potash. Base targets on a soil test; split N across growth stages.',
        };
      },
    },
    seeding: {
      name: 'Seeding rate', ico: 'sprout', desc: 'Plant population and seed needed.',
      fields: [
        { k: 'area', label: 'Area', type: 'number', value: 1, suffix: 'ha', step: .1 },
        { k: 'row', label: 'Row spacing', type: 'number', value: 75, suffix: 'cm' },
        { k: 'hill', label: 'Hill spacing', type: 'number', value: 25, suffix: 'cm' },
        { k: 'per', label: 'Seeds per hill', type: 'number', value: 1, min: 1 },
        { k: 'germ', label: 'Germination', type: 'number', value: 90, suffix: '%' },
        { k: 'tsw', label: 'Weight of 1,000 seeds', type: 'number', value: 300, suffix: 'g' },
      ],
      calc(v) {
        const hills = v.row > 0 && v.hill > 0 ? 10000 / ((v.row / 100) * (v.hill / 100)) : 0; const plants = hills * Math.max(1, v.per);
        const seeds = v.germ > 0 ? (plants / (v.germ / 100)) * v.area : 0; const kg = (seeds * v.tsw) / 1e6;
        return {
          say: `Plant about ${num(Math.round(plants))} per hectare. You need roughly ${num(kg, 1)} kg of seed for ${num(v.area, 1)} ha.`,
          stats: [{ l: 'Plants per ha', v: num(Math.round(plants)), tone: 'accent' }, { l: 'Seeds to sow', v: num(Math.round(seeds)) }, { l: 'Seed needed', v: `${num(kg, 1)} kg`, tone: 'accent' }],
          note: 'Add 5–10% for re-planting gaps. Example: hybrid corn at 75 × 25 cm gives about 53,000 plants per hectare.',
        };
      },
    },
  };

  /* ---------------- Roles (job models) ---------------- */
  const PH = 'Default to Philippine context (peso, BIR, SEC, DOLE, SSS, PhilHealth, Pag-IBIG) when local rules matter, unless the user says otherwise. Rules and rates change: say when something should be checked against the latest official source.';
  const ROLES = [
    { id: 'accountant', name: 'Accountant', ico: 'calc', tagline: 'Bookkeeping, reconciliations, financial statements and VAT.',
      skills: ['Journal entries and ledgers', 'Bank reconciliations', 'Financial statements (PFRS)'],
      persona: `You are acting as the user's senior accountant (CPA level). Prepare journal entries with debit and credit columns, reconcile accounts, explain PFRS treatment, build financial statements and check figures carefully. Show the math in tables. ${PH}`,
      tasks: [
        { ico: 'file', t: 'Journal entries', s: 'Record transactions correctly.', p: 'Prepare the journal entries (date, account, debit, credit) for these transactions: [list your transactions with dates and amounts]' },
        { ico: 'sheet', t: 'Bank reconciliation', s: 'Match books to the bank.', p: 'Help me prepare a bank reconciliation. Book balance: [amount]. Bank balance: [amount]. Outstanding checks, deposits in transit and bank charges: [details]' },
        { ico: 'bars', t: 'Financial statements', s: 'Income statement and balance sheet.', p: 'Prepare an income statement and balance sheet from this trial balance: [paste trial balance]' },
        { ico: 'tool', tool: 'vat', t: 'VAT calculator', s: 'Add or remove 12% VAT.' },
      ], tools: ['vat', 'depreciation'] },
    { id: 'tax', name: 'Tax Associate', ico: 'receipt', tagline: 'Income tax, withholding, VAT returns and BIR deadlines.',
      skills: ['Income tax under TRAIN', 'Withholding on compensation', 'BIR forms and deadlines'],
      persona: `You are acting as the user's tax associate. Compute Philippine income tax (graduated rates or 8%), withholding taxes, VAT and percentage tax, explain BIR forms (1701, 1701Q, 2550Q, 1601-C, 2316 and others) and filing deadlines. Show computations step by step and note assumptions. ${PH}`,
      tasks: [
        { ico: 'tool', tool: 'incomeTax', t: 'Income tax', s: 'Estimate tax due under TRAIN.' },
        { ico: 'tool', tool: 'payroll', t: 'Withholding tax', s: 'Monthly payroll deductions.' },
        { ico: 'calendar', t: 'Filing calendar', s: 'BIR deadlines for this quarter.', p: 'List the BIR filing and payment deadlines for this quarter for a [VAT / non-VAT] [individual / corporation], with the form number for each.' },
        { ico: 'file', t: 'Explain a BIR form', s: 'What goes in each part.', p: 'Explain BIR Form [form number] in plain language: who files it, when, and how to fill in each part.' },
      ], tools: ['incomeTax', 'payroll'] },
    { id: 'finance', name: 'Finance Manager', ico: 'bars', tagline: 'Budgets, cash flow, forecasts, loans and investment decisions.',
      skills: ['Budgets and variance analysis', 'Cash-flow forecasting', 'Loan and investment analysis'],
      persona: `You are acting as the user's finance manager. Build budgets and forecasts, analyze variances, model cash flow, evaluate loans and investments (NPV, IRR, payback) and present findings with clear tables and a short recommendation. ${PH}`,
      tasks: [
        { ico: 'sheet', t: 'Budget vs actual', s: 'Explain the variances.', p: 'Analyze budget vs actual and explain the biggest variances: [paste budget and actual by line item]' },
        { ico: 'trend', t: 'Cash-flow forecast', s: '13-week cash projection.', p: 'Build a 13-week cash-flow forecast. Opening cash: [amount]. Expected weekly receipts: [details]. Expected payments: [details]' },
        { ico: 'tool', tool: 'loan', t: 'Loan amortization', s: 'Payment, interest and schedule.' },
        { ico: 'tool', tool: 'npv', t: 'Investment decision', s: 'NPV, IRR and payback.' },
      ], tools: ['loan', 'npv'] },
    { id: 'legal', name: 'Legal Assistant', ico: 'scale', tagline: 'Contracts, clause reviews, legal letters and deadlines.',
      skills: ['Contract drafting and review', 'Demand and notice letters', 'Deadline tracking'],
      persona: `You are acting as the user's legal assistant. Draft and review contracts, flag risky or missing clauses, write demand letters and notices, and summarize legal documents in plain language. You give general legal information, not legal advice; recommend a lawyer for decisions with real consequences. ${PH}`,
      tasks: [
        { ico: 'file', t: 'Draft a contract', s: 'A complete first draft.', p: 'Draft a [type of contract] between [party A] and [party B] for [purpose], under Philippine law, with numbered clauses.' },
        { ico: 'shield', t: 'Review a contract', s: 'Find risks and gaps.', p: 'Review this contract. List risky clauses, missing protections and suggested wording: [paste contract]' },
        { ico: 'mail', t: 'Demand letter', s: 'Firm and professional.', p: 'Write a demand letter to [name] for [unpaid amount or obligation], due since [date]. Give them [number] days to comply.' },
        { ico: 'tool', tool: 'deadline', t: 'Deadline calculator', s: 'Count filing periods.' },
      ], tools: ['deadline', 'clauses'] },
    { id: 'marketing', name: 'Marketing Manager', ico: 'megaphone', tagline: 'Campaigns, content calendars, copy and performance.',
      skills: ['Campaign strategy', 'Content and ad copy', 'Performance analysis'],
      persona: 'You are acting as the user\'s marketing manager. Plan campaigns with a clear audience, message and channel mix, write on-brand copy in several variations, build content calendars and analyze ROAS, CPA and funnel metrics. Be concrete: give budgets, dates and KPIs.',
      tasks: [
        { ico: 'target', t: 'Campaign plan', s: 'Audience, channels and budget.', p: 'Create a campaign plan for [product] aimed at [audience]. Budget: [amount]. Goal: [goal]. Include channels, timeline and KPIs.' },
        { ico: 'calendar', t: 'Content calendar', s: 'A month of posts.', p: 'Build a 4-week social media content calendar for [brand] on [platforms], with post ideas, captions and hashtags.' },
        { ico: 'pencil', t: 'Ad copy', s: '5 variations to test.', p: 'Write 5 ad copy variations (headline, primary text, call to action) for [product] targeting [audience].' },
        { ico: 'tool', tool: 'roas', t: 'Campaign ROI', s: 'ROAS, CPA and CTR.' },
      ], tools: ['roas', 'utm'] },
    { id: 'sales', name: 'Sales Executive', ico: 'trend', tagline: 'Prospecting, proposals, follow-ups and forecasts.',
      skills: ['Prospecting and outreach', 'Proposals and objection handling', 'Pipeline forecasting'],
      persona: 'You are acting as the user\'s senior sales executive. Write outreach and follow-up messages, prepare proposals and quotes, handle objections, plan accounts and forecast the pipeline. Keep messages short, specific and focused on the customer\'s outcome.',
      tasks: [
        { ico: 'mail', t: 'Outreach email', s: 'A first message that gets replies.', p: 'Write a short cold outreach email to [role] at [company type] about [product/service]. Mention [a specific pain point].' },
        { ico: 'file', t: 'Sales proposal', s: 'Scope, pricing and next steps.', p: 'Draft a sales proposal for [client] for [product/service]. Price: [amount]. Include scope, timeline, pricing table and next steps.' },
        { ico: 'users', t: 'Handle objections', s: 'Answers that move deals.', p: 'Give me strong responses to these customer objections: [list objections, e.g. "too expensive", "we already have a supplier"]' },
        { ico: 'tool', tool: 'pipeline', t: 'Pipeline forecast', s: 'Weighted forecast vs target.' },
      ], tools: ['pipeline', 'commission'] },
    { id: 'hr', name: 'HR Manager', ico: 'users', tagline: 'Hiring, policies, payroll, benefits and employee relations.',
      skills: ['Job descriptions and interviews', 'Policies and memos', 'Pay, overtime and benefits'],
      persona: `You are acting as the user's HR manager. Write job descriptions, interview guides, policies, memos and notices to explain (NTE), compute pay items (overtime, holiday pay, 13th month) and advise on fair, compliant employee relations. ${PH}`,
      tasks: [
        { ico: 'file', t: 'Job description', s: 'Role, duties and requirements.', p: 'Write a job description for a [job title] at a [company type]: summary, duties, qualifications and benefits.' },
        { ico: 'clipboard', t: 'Interview guide', s: 'Questions and a scorecard.', p: 'Create an interview guide with 10 questions and a scoring rubric for a [job title] role.' },
        { ico: 'tool', tool: 'overtime', t: 'Overtime pay', s: 'Premiums from a monthly rate.' },
        { ico: 'tool', tool: 'thirteenth', t: '13th month pay', s: 'Amount due and taxable part.' },
      ], tools: ['overtime', 'thirteenth'] },
    { id: 'operations', name: 'Operations Manager', ico: 'settings', tagline: 'Processes, inventory, capacity and supplier management.',
      skills: ['SOPs and process maps', 'Inventory and purchasing', 'Capacity and OEE'],
      persona: 'You are acting as the user\'s operations manager. Write SOPs and checklists, map and improve processes, plan inventory and purchasing (EOQ, reorder points, safety stock), track capacity and OEE, and compare suppliers. Give practical steps with owners and metrics.',
      tasks: [
        { ico: 'clipboard', t: 'Write an SOP', s: 'Step-by-step procedure.', p: 'Write a standard operating procedure for [process], with purpose, scope, responsibilities, numbered steps and a checklist.' },
        { ico: 'tool', tool: 'eoq', t: 'Reorder point', s: 'How much to order and when.' },
        { ico: 'tool', tool: 'oee', t: 'OEE', s: 'Equipment effectiveness.' },
        { ico: 'sheet', t: 'Supplier comparison', s: 'Score and choose suppliers.', p: 'Build a weighted scorecard to compare these suppliers on price, quality, lead time and reliability: [list suppliers and details]' },
      ], tools: ['eoq', 'oee'] },
    { id: 'developer', name: 'Software Developer', ico: 'codewin', tagline: 'Code, debugging, APIs, databases and reviews.',
      skills: ['Write and refactor code', 'Debug errors', 'APIs, SQL and reviews'],
      persona: 'You are acting as the user\'s senior software developer. Write complete, working, well-structured code, debug errors from stack traces, design APIs and database schemas, write SQL and tests, and review code for bugs and security. Prefer simple solutions and explain trade-offs briefly.',
      tasks: [
        { ico: 'code', t: 'Build a feature', s: 'Working code, ready to run.', p: 'Write [language/framework] code that [what it should do]. Include brief setup steps.' },
        { ico: 'shield', t: 'Debug an error', s: 'Find the cause and fix it.', p: 'Help me fix this error. What I was doing: [context]. Error and code: [paste]' },
        { ico: 'sheet', t: 'Database & SQL', s: 'Schema and queries.', p: 'Design a database schema for [app] and write the SQL to [query you need].' },
        { ico: 'tool', tool: 'json', t: 'JSON formatter', s: 'Validate and pretty-print.' },
      ], tools: ['json', 'regex'] },
    { id: 'agronomist', name: 'Agronomist', ico: 'sprout', tagline: 'Crop plans, soil and fertilizer, pests and yields.',
      skills: ['Crop and planting plans', 'Soil and fertilizer programs', 'Pest and disease management'],
      persona: `You are acting as the user's agronomist. Plan crops and planting calendars, interpret soil tests, build fertilizer programs (N-P-K in kg/ha and bags), identify pests and diseases from descriptions, recommend integrated pest management and estimate yields and costs. Favor safe, practical field advice. ${PH} Refer to the Department of Agriculture, PhilRice or local agriculturists where helpful.`,
      tasks: [
        { ico: 'calendar', t: 'Crop calendar', s: 'Planting to harvest.', p: 'Make a crop calendar for [crop] planted in [month] in [province], from land preparation to harvest, with fertilizer timing.' },
        { ico: 'tool', tool: 'fertilizer', t: 'Fertilizer plan', s: 'Bags needed for your target.' },
        { ico: 'shield', t: 'Pest or disease', s: 'Identify and treat.', p: 'My [crop] shows these symptoms: [describe leaves, stems, pattern]. What could it be and how do I manage it?' },
        { ico: 'tool', tool: 'seeding', t: 'Seeding rate', s: 'Plants per ha and seed kg.' },
      ], tools: ['fertilizer', 'seeding'] },
  ];
  const GENERAL = { id: 'general', name: 'General assistant', ico: 'spark', tagline: 'No job model: a general assistant for any task.', skills: ['Writing and documents', 'Analysis and planning', 'Code, images and video'], persona: '',
    tasks: [
      { ico: 'file', t: 'Write a document', s: 'Draft, edit and refine.', p: 'Write a [type of document] about [topic] for [audience].' },
      { ico: 'sheet', t: 'Analyze data', s: 'Turn numbers into insight.', p: 'Analyze this data and tell me the key trends and what to do next: [paste data]' },
      { ico: 'code', t: 'Build with code', s: 'From idea to working app.', p: 'Build a working [app or page] in HTML that [what it should do].' },
      { ico: 'image', t: 'Create an image', s: 'Bring your ideas to life.', p: 'Generate an image of [describe the scene]' },
    ], tools: ['vat', 'loan'] };
  const ALL = [...ROLES, GENERAL];
  const roleById = (id) => ALL.find((r) => r.id === id);

  /* ---------------- State ---------------- */
  let A = null; let roleId = 'general'; let painted = ''; let showAll = false;
  // 'overview' = the workspace home; 'chat' = a clean New chat screen.
  let mode = 'overview'; let toOverview = false;
  const activeTool = {}; let vals = {};

  const role = () => roleById(roleId) || ROLES[0];
  const isPro = () => !!A && A.state.skin === 'pro';

  function defaults(id) { const o = {}; T[id].fields.forEach((f) => { o[f.k] = f.value === 'today' ? iso(new Date()) : Array.isArray(f.value) ? f.value.slice() : f.value; }); return o; }
  function valuesFor(id) { if (!vals[id]) vals[id] = defaults(id); return vals[id]; }
  const saveVals = () => A.store.set('pro:tools', vals);

  /* ---------------- Rendering ---------------- */
  function paintRole() {
    const r = role();
    A.$('#roleName').textContent = r.name;
    A.$('#roleIco use').setAttribute('href', `#i-${r.ico}`);
    A.$('#roleBtn').title = `Your assistant: ${r.name}. Click to change.`;
    A.$('#prompt').placeholder = 'Describe your task, or share an idea…';
  }

  function renderTasks(animate) {
    const r = role();
    A.$('#proTasks').innerHTML = r.tasks.map((t, i) => `<button type="button" class="pt-card${animate ? ' swap' : ''}" style="--d:${i * 45}ms" data-task="${i}">
      <span class="pt-ico">${A.icon(t.tool ? T[t.tool].ico : t.ico)}</span>
      <span class="pt-text"><b>${A.esc(t.t)}</b><small>${A.esc(t.s)}</small></span>
      ${t.tool ? '<span class="pt-tag">Tool</span>' : ''}</button>`).join('');
  }

  const fmtNum = (val, f) => (f.step && f.step < 1) || Math.abs(+val) < 1000 ? String(val) : Number(val).toLocaleString('en-PH', { maximumFractionDigits: 4 });
  function fieldHTML(id, f, v) {
    const name = `${id}-${f.k}`; const val = v[f.k];
    const hint = f.hint ? `<small class="pk-hint">${A.esc(f.hint)}</small>` : '';
    if (f.type === 'select') return `<label class="pk-field${f.wide ? ' wide' : ''}" for="${name}"><span>${A.esc(f.label)}</span><span class="pk-input sel"><select id="${name}" data-k="${f.k}">${f.options.map((o) => `<option${o === val ? ' selected' : ''}>${A.esc(o)}</option>`).join('')}</select>${A.icon('down', 'sm')}</span>${hint}</label>`;
    if (f.type === 'textarea') return `<label class="pk-field wide" for="${name}"><span>${A.esc(f.label)}</span><textarea id="${name}" data-k="${f.k}" rows="4" spellcheck="false">${A.esc(val)}</textarea>${hint}</label>`;
    if (f.type === 'checks') return `<fieldset class="pk-field wide pk-checks"><legend>${A.esc(f.label)} <small>(tap to tick)</small></legend><div>${f.options.map((o) => `<label class="pk-check"><input type="checkbox" data-k="${f.k}" value="${A.esc(o)}"${val.includes(o) ? ' checked' : ''}><span>${A.icon('check', 'sm')}${A.esc(o)}</span></label>`).join('')}</div></fieldset>`;
    const isNum = f.type === 'number';
    const type = f.type === 'date' ? 'date' : 'text';
    const extra = isNum ? ' inputmode="decimal" data-num="1" autocomplete="off"' : ' spellcheck="false"';
    return `<label class="pk-field${f.wide ? ' wide' : ''}" for="${name}"><span>${A.esc(f.label)}</span><span class="pk-input">${f.prefix ? `<i>${f.prefix}</i>` : ''}<input id="${name}" type="${type}" data-k="${f.k}" value="${A.esc(isNum ? fmtNum(val, f) : val)}"${extra}>${f.suffix ? `<i>${A.esc(f.suffix)}</i>` : ''}</span>${hint}</label>`;
  }

  function renderKit(animate) {
    const r = role(); const box = A.$('#proKit');
    const ids = r.tools; const cur = ids.includes(activeTool[r.id]) ? activeTool[r.id] : ids[0]; activeTool[r.id] = cur;
    const who = r.id === 'general' ? 'the assistant' : `your ${r.name}`;
    box.innerHTML = `
      <div class="pk-banner">
        <img src="assets/img/cubes.webp" alt="" loading="lazy" decoding="async">
        <div class="pk-banner-in">
          <span class="pk-badge">${A.icon(r.ico, 'sm')}${A.esc(r.id === 'general' ? 'General assistant' : 'Your assistant · ' + r.name)}</span>
          <h2 id="pk-h">${A.esc(r.id === 'general' ? 'Quick tools' : r.name + ' tools')}</h2>
          <p>Pick a tool, type your numbers, and the answer appears instantly. No sign-up or formulas needed.</p>
        </div>
        <button type="button" class="pk-change" data-action="role-menu">${A.icon('sliders', 'sm')}Change role</button>
      </div>
      <div class="pk-tabs" role="tablist" aria-label="Tools">${ids.map((id) => `<button type="button" role="tab" aria-selected="${id === cur}" data-tool="${id}"><span class="pk-tab-ico">${A.icon(T[id].ico)}</span><span class="pk-tab-text"><b>${A.esc(T[id].name)}</b><small>${A.esc(T[id].desc)}</small></span></button>`).join('')}</div>
      <div class="pk-card${animate ? ' swap' : ''}" role="tabpanel" aria-labelledby="pk-h">
        <div class="pk-in">
          <div class="pk-step"><b>1</b><span>Enter your details</span><button type="button" class="pk-reset" data-kit="reset" title="Put the example values back">${A.icon('clock', 'sm')}Reset</button></div>
          <form class="pk-form" data-toolform="${cur}" autocomplete="off" onsubmit="return false">${T[cur].fields.map((f) => fieldHTML(cur, f, valuesFor(cur))).join('')}</form>
        </div>
        <div class="pk-res">
          <div class="pk-step"><b>2</b><span>Your answer</span></div>
          <div class="pk-out" id="pkOut" aria-live="polite"></div>
          <div class="pk-actions">
            <button type="button" class="pk-btn primary" data-kit="ask">${A.icon('spark')}Ask ${A.esc(who)} to explain</button>
            <button type="button" class="pk-btn" data-kit="copy" title="Copy the result">${A.icon('copy')}Copy</button>
            <button type="button" class="pk-btn" data-kit="pdf" title="Download the result as a PDF">${A.icon('download')}PDF</button>
            <button type="button" class="pk-btn" data-kit="save" title="Keep it in Artifacts">${A.icon('grid')}Save</button>
          </div>
        </div>
      </div>`;
    renderOut();
  }

  let lastOut = null; let detailsOpen = false;
  function renderOut() {
    const id = activeTool[role().id]; const tool = T[id]; const v = valuesFor(id);
    let o; try { o = tool.calc(v, tool.fields) || {}; } catch (e) { o = { say: 'Something in the numbers does not work. Check the values on the left.', stats: [{ l: 'Error', v: e.message, tone: 'bad' }] }; }
    lastOut = { id, o };
    const s = (o.stats || []).map((x) => `<div class="pk-stat ${x.tone || ''}"><small>${A.esc(x.l)}</small><b>${A.esc(x.v)}</b></div>`).join('');
    const t = o.table ? `<details class="pk-details"${detailsOpen ? ' open' : ''}><summary>${A.icon('chev', 'sm')}See the full breakdown <small>${o.table.rows.length} row${o.table.rows.length === 1 ? '' : 's'}</small></summary><div class="tbl-wrap"><table class="tbl"><thead><tr>${o.table.head.map((h) => `<th>${A.esc(h)}</th>`).join('')}</tr></thead><tbody>${o.table.rows.map((r) => `<tr>${r.map((c, i) => `<td${i && /^[−₱\d-]/.test(c) ? ' class="num"' : ''}>${A.esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : '';
    A.$('#pkOut').innerHTML = `${o.say ? `<p class="pk-say">${A.esc(o.say)}</p>` : ''}${s ? `<div class="pk-stats">${s}</div>` : ''}${o.pre ? `<pre class="pk-pre">${A.esc(o.pre)}</pre>` : ''}${t}${o.note ? `<p class="pk-note">${A.icon('spark', 'sm')}<span>${A.esc(o.note)}</span></p>` : ''}`;
    const d = A.$('#pkOut .pk-details'); if (d) d.addEventListener('toggle', () => { detailsOpen = d.open; });
  }

  function outText(brief) {
    const { id, o } = lastOut; const tool = T[id]; const v = valuesFor(id); const L = [`${tool.name} (${role().name})`, ''];
    if (o.say) L.push(o.say, '');
    L.push('Inputs:'); tool.fields.forEach((f) => { const x = v[f.k]; L.push(`- ${f.label}: ${Array.isArray(x) ? x.join(', ') || 'none' : `${f.prefix || ''}${f.type === 'number' ? num(+x, 2).replace(/\.00$/, '') : x}${f.suffix ? ' ' + f.suffix : ''}`}`); });
    if (o.stats && o.stats.length) { L.push('', 'Results:'); o.stats.forEach((x) => L.push(`- ${x.l}: ${x.v}`)); }
    if (o.pre) L.push('', o.pre);
    if (o.table && !brief) { L.push('', `| ${o.table.head.join(' | ')} |`, `| ${o.table.head.map(() => '---').join(' | ')} |`); o.table.rows.forEach((r) => L.push(`| ${r.join(' | ')} |`)); }
    if (o.note) L.push('', o.note);
    return L.join('\n');
  }

  function kitAction(k) {
    if (!lastOut) return;
    const tool = T[lastOut.id]; const r = role();
    if (k === 'reset') { vals[lastOut.id] = defaults(lastOut.id); saveVals(); renderKit(); A.toast(`${tool.name} reset`); return; }
    if (k === 'copy') { A.copy(lastOut.o.copyText || outText(), 'Result copied'); return; }
    if (k === 'save') {
      const name = `${tool.name} ${new Date().toISOString().slice(0, 10)}.md`;
      A.state.artifacts = A.state.artifacts.filter((a) => a.name !== name);
      A.state.artifacts.unshift({ name, kind: 'code', lang: 'markdown', meta: `${r.name} · ${tool.name}`, time: Date.now(), code: outText(), gen: true });
      A.save(); A.renderRecents(); A.toast(`Saved ${name} to Artifacts`, 'download'); A.log(`Saved ${name}`); return;
    }
    if (k === 'pdf') { const t = outText(); const md = `# ${tool.name}\n\n${t.split('\n').slice(2).join('\n').replace(/^(Inputs|Results):$/gm, '## $1')}`; window.GASDocs ? window.GASDocs.save('pdf', md, `${tool.name} (${r.name})`).then((n) => A.toast(`Downloaded ${n}`, 'download')).catch((e) => A.toast(e.message, 'x')) : A.toast('PDF export is not available.', 'x'); return; }
    if (k === 'ask') {
      const msg = lastOut.o.ask || `Here are the results from my ${tool.name}. Check them, explain what they mean in plain language, and tell me what I should do next.\n\n${outText(true)}`;
      A.send(msg);
    }
  }

  /* Continue working */
  const ago = (t) => {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) { const m = Math.round(s / 60); return `${m} minute${m === 1 ? '' : 's'} ago`; }
    if (s < 86400) { const h = Math.round(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago`; }
    const d = Math.round(s / 86400); return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(t).toLocaleDateString('en-PH', { day: 'numeric', month: 'short' });
  };
  function kindOf(c) {
    const t = c.title.toLowerCase();
    const byRole = { accountant: 'report', tax: 'report', finance: 'report', sales: 'report', marketing: 'campaign', developer: 'build' };
    if (/website|proposal|document|letter|contract|memo|policy|plan\b/.test(t)) return 'web';
    if (/report|budget|financ|revenue|forecast|tax|payroll|account|invoice|sales|pipeline|commission|cash|loan|npv|vat/.test(t)) return 'report';
    if (/campaign|brand|market|product|social|launch|ad |ads|content|skincare/.test(t)) return 'campaign';
    if (/code|build|app|api|agent|software|developer|sql|json|regex|script|automation|system/.test(t)) return 'build';
    return byRole[c.role] || 'web';
  }
  const APP = { report: ['X', 'Spreadsheet'], campaign: ['P', 'Presentation'], build: ['</>', 'Code'], web: ['W', 'Document'] };
  function thumb(kind) {
    if (kind === 'web') return `<div class="th th-web"><div class="tw-bar"><i></i><i></i><i></i><b></b><b></b></div><div class="tw-body"><div class="tw-copy"><i></i><i></i><i class="s"></i><span></span></div><img src="assets/img/mountains.webp" alt="" loading="lazy" decoding="async"></div></div>`;
    if (kind === 'campaign') return `<div class="th th-camp"><img src="assets/img/product.webp" alt="" loading="lazy" decoding="async"><div class="tc-ui"><div class="tc-sq"><i></i><i></i><i></i></div><i class="l"></i><i class="l"></i><i class="l s"></i></div></div>`;
    if (kind === 'build') return `<div class="th th-build"><img src="assets/img/cubes.webp" alt="" loading="lazy" decoding="async"><code>&lt;agent run="build"/&gt;</code></div>`;
    return `<div class="th th-report"><svg viewBox="0 0 160 70" aria-hidden="true"><g class="bars"><rect x="6" y="52" width="9" height="14" rx="1.5"/><rect x="20" y="44" width="9" height="22" rx="1.5"/><rect x="34" y="36" width="9" height="30" rx="1.5"/><rect x="48" y="28" width="9" height="38" rx="1.5"/><rect x="62" y="18" width="9" height="48" rx="1.5"/></g><path class="axis" d="M2 66h76"/><circle class="donut-bg" cx="106" cy="36" r="17"/><circle class="donut" cx="106" cy="36" r="17" pathLength="100" stroke-dasharray="72 28" transform="rotate(-90 106 36)"/><g class="lines"><rect x="132" y="22" width="24" height="3" rx="1.5"/><rect x="132" y="30" width="18" height="3" rx="1.5"/><rect x="132" y="38" width="24" height="3" rx="1.5"/><rect x="132" y="46" width="14" height="3" rx="1.5"/></g></svg></div>`;
  }
  function renderWork() {
    const list = A.state.convos.filter((c) => !c.archived && c.messages && c.messages.length).sort((a, b) => b.updated - a.updated);
    const shown = list.slice(0, showAll ? 12 : 3);
    const btn = A.$('#proViewAll');
    btn.hidden = list.length <= 3; btn.firstChild.textContent = showAll ? 'Show less' : 'View all';
    btn.setAttribute('aria-expanded', String(showAll));
    A.$('#proWork').innerHTML = shown.length ? shown.map((c) => {
      const k = kindOf(c); const [ab, an] = APP[k]; const rr = c.role && roleById(c.role);
      return `<article class="pw-card">
        <div class="pw-thumb">${thumb(k)}${rr && rr.id !== 'general' ? `<span class="pw-role">${A.icon(rr.ico, 'sm')}${A.esc(rr.name)}</span>` : ''}</div>
        <div class="pw-meta"><span class="pw-app a-${k}" title="${an}">${A.esc(ab)}</span>
          <span class="pw-text"><button type="button" class="pw-open" data-convo="${c.id}">${c.pinned ? A.icon('pin', 'sm') : ''}${A.esc(c.title)}</button><small>Updated ${ago(c.updated)}</small></span>
          <button type="button" class="pw-more" data-convo-menu="${c.id}" aria-label="Options for ${A.esc(c.title)}" aria-haspopup="menu">${A.icon('more')}</button></div>
      </article>`;
    }).join('') : `<div class="pw-empty">${A.icon('spark')}<div><b>Nothing to continue yet</b><small>Your chats appear here so you can pick up where you left off.</small></div></div>`;
  }

  const SEC_NAMES = { projects: 'Projects', artifacts: 'Artifacts', code: 'Code', agents: 'Agents', scheduled: 'Scheduled', team: 'Team room' };
  function paintChrome() {
    const st = A.state; const c = A.current();
    const empty = st.section === 'chat' && !(c && c.messages.length);
    const here = st.section !== 'chat' ? SEC_NAMES[st.section] || 'Workspace' : !empty ? c.title : mode === 'chat' ? 'New chat' : 'Home';
    A.$('#crumbHere').textContent = here;
    A.$('[data-pro-nav="overview"]').classList.toggle('active', empty && mode === 'overview');
    A.$('.new-chat').classList.toggle('on', empty && mode === 'chat');
    const n = A.$('[data-pro-count="artifacts"]'); n.textContent = st.artifacts.length || '';
    const nm = ((st.prefs && st.prefs.displayName) || '').trim();
    A.$('#pfName').textContent = nm || 'Assistant';
    A.$('#pfAvatar').textContent = nm ? nm.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : 'AI';
    A.$('#pfPlan').textContent = A.$('#planName').textContent;
  }

  /* ---------------- Menus ---------------- */
  function roleMenu(anchor) {
    const item = (r) => `<button class="pop-item role-item${r.id === roleId ? ' on' : ''}" data-pick="${r.id}" role="menuitemradio" aria-checked="${r.id === roleId}">${A.icon(r.ico)}<span><b>${A.esc(r.name)}</b></span>${r.id === roleId ? A.icon('check', 'chk') : ''}</button>`;
    const groups = [['Finance', ['accountant', 'tax', 'finance']], ['Business', ['marketing', 'sales', 'hr', 'operations']], ['Specialists', ['legal', 'developer', 'agronomist']]];
    A.popover(anchor, `<div class="role-menu" role="menu" aria-label="Choose your assistant">${item(GENERAL)}${groups.map(([label, ids]) => `<p class="pop-title">${label}</p>${ids.map(id => item(roleById(id))).join('')}`).join('')}</div>`, (v) => setRole(v));
    const pop = A.$('#popover');
    if (!pop.hidden) { const sel = A.$('.role-item.on', pop) || A.$('.role-item', pop); if (sel) sel.focus({ preventScroll: true }); }
  }
  function jobMenu(anchor) {
    const r = role();
    A.popover(anchor, `<div class="job-card"><p class="pop-title">Your assistant</p><h4>${A.icon(r.ico)}${A.esc(r.name)}</h4><p>${A.esc(r.tagline)}</p>
      <ul>${r.skills.map((s) => `<li>${A.icon('check', 'sm')}${A.esc(s)}</li>`).join('')}</ul>
      <p class="job-how">The AI answers as your ${A.esc(r.name.toLowerCase())}. The quick actions and tools on this page match the role.</p></div>
      <div class="pop-sep"></div>
      <button class="pop-item" data-pick="tools">${A.icon('calc')}<span><b>Open ${A.esc(r.name)} tools</b><small>${r.tools.map((t) => T[t].name).join(' · ')}</small></span></button>
      <button class="pop-item" data-pick="change">${A.icon('sliders')}<span><b>Change role</b><small>10 job models</small></span></button>`,
    (v) => { if (v === 'tools') scrollToKit(); else setTimeout(() => roleMenu(A.$('#roleBtn')), 0); });
  }
  function composeMenu(anchor) {
    const st = A.state;
    const MODES = [['Normal', 'Chats and acts, asking before changing files', 'pencil'], ['Plan', 'Outlines the steps before doing anything', 'layers'], ['Quick', 'Short, direct answers', 'spark']];
    A.popover(anchor, `<p class="pop-title">Response mode</p>${MODES.map(([n, d, i]) => `<button class="pop-item" data-pick="mode:${n}">${A.icon(i)}<span><b>${n}</b><small>${d}</small></span>${st.mode === n ? A.icon('check', 'chk') : ''}</button>`).join('')}
      <div class="pop-sep"></div>
      <button class="pop-item" data-pick="voice">${A.icon('volume')}<span><b>Read replies aloud</b><small>${st.voice ? 'On' : 'Off'}</small></span>${st.voice ? A.icon('check', 'chk') : ''}</button>
      <button class="pop-item" data-pick="auto">${A.icon('shield')}<span><b>Auto-approve</b><small>${st.auto ? 'On: acts without asking' : 'Off: asks before changing files'}</small></span>${st.auto ? A.icon('check', 'chk') : ''}</button>
      <div class="pop-sep"></div>
      <button class="pop-item" data-pick="settings">${A.icon('settings')}<span><b>All settings</b><small>Style, language, instructions</small></span></button>`,
    (v) => {
      if (v.startsWith('mode:')) { st.mode = v.slice(5); A.$('#modeName').textContent = st.mode; A.toast(`${st.mode} mode`); A.log(`Mode set to ${st.mode}`); }
      else if (v === 'voice') A.$('#voiceBtn').click();
      else if (v === 'auto') A.$('#autoBtn').click();
      else if (v === 'settings') A.openSettings('model');
    });
  }
  function profileMenu(anchor) {
    const nm = A.$('#pfName').textContent;
    A.popover(anchor, `<div class="pf-head"><span class="pf-avatar">${A.esc(A.$('#pfAvatar').textContent)}</span><span><b>${A.esc(nm)}</b><small>${A.esc(A.$('#planName').textContent)}</small></span></div>
      <div class="pop-sep"></div>
      <button class="pop-item" data-pick="account">${A.icon('user')}<span><b>Account</b><small>Name and preferences</small></span></button>
      <button class="pop-item" data-pick="billing">${A.icon('card')}<span><b>Plans &amp; billing</b><small>Upgrade or manage your plan</small></span></button>
      <button class="pop-item" data-pick="folder">${A.icon('folder')}<span><b>Open local folder</b><small>Let the agent read your files</small></span></button>
      <button class="pop-item" data-pick="tour">${A.icon('compass')}<span><b>Guide &amp; tour</b><small>A quick walkthrough</small></span></button>
      <button class="pop-item" data-pick="activity">${A.icon('terminal')}<span><b>Activity log</b><small>What the agent did</small></span></button>
      <div class="pop-sep"></div>
      <button class="pop-item" data-pick="skins">${A.icon('layers')}<span><b>Change interface</b><small>Glass, Clay, Cyber, Nebula, Gold, Matte</small></span></button>
      <button class="pop-item" data-pick="studio">${A.icon('home')}<span><b>Interface studio</b><small>White label and logo kit</small></span></button>`,
    (v) => {
      if (v === 'account') A.openSettings('account'); else if (v === 'billing') A.openSettings('billing');
      else if (v === 'folder') A.pickFolder(); else if (v === 'tour') A.startTour();
      else if (v === 'activity') A.$('[data-action="activity"]').click();
      else if (v === 'studio') location.hash = 'studio';
      else if (v === 'skins') { A.openPalette(); const i = A.$('#palInput'); i.value = 'interface'; i.dispatchEvent(new Event('input')); }
    });
  }

  function scrollToKit() {
    const k = A.$('#proKit'); if (!k) return;
    const toolbox = k.closest('details'); if (toolbox) toolbox.open = true;
    k.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    k.classList.remove('flash'); void k.offsetWidth; k.classList.add('flash');
  }

  function setRole(id, silent) {
    if (!roleById(id)) return;
    const changed = id !== roleId;
    roleId = id; A.store.set('role', id);
    paintRole();
    if (changed || painted !== id) { renderTasks(!silent); renderKit(!silent); painted = id; }
    paintMode();
    if (!silent && changed) { const r = role(); A.toast(r.id === 'general' ? 'General assistant · no job model' : `${r.name} job model · quick actions and tools updated`, r.ico); A.log(`Job model: ${r.name}`); }
  }

  function fillPrompt(p) {
    const ta = A.$('#prompt'); ta.value = p; A.autosize(); ta.focus();
    const a = p.indexOf('['), b = p.indexOf(']', a);
    if (a >= 0 && b > a) ta.setSelectionRange(a, b + 1); else ta.setSelectionRange(ta.value.length, ta.value.length);
    A.$('.composer').classList.remove('nudge'); void ta.offsetWidth; A.$('.composer').classList.add('nudge');
  }
  const starters = () => {
    const r = role(); const own = r.tasks.filter((t) => !t.tool).slice(0, 2);
    return [
      { ico: 'image', t: 'Create an image', p: 'Generate an image of [describe what you want to see]' },
      { ico: 'file', t: 'Write a PDF or Word document', p: 'Write a [type of document, e.g. proposal or letter] about [topic] as a PDF and Word file.' },
      { ico: 'search', t: 'Look up a person or topic', p: 'Who is [name of a public figure, company or topic]?' },
      ...own.map((t) => ({ ico: t.ico, t: t.t, p: t.p })),
    ];
  };
  function paintMode() {
    const chat = mode === 'chat'; const r = role();
    A.$('#chatView').classList.toggle('pro-newchat', chat);
    A.$('.ph-pill').textContent = chat ? 'New chat' : 'A little clarity. A lot of possibility.';
    A.$('.ph-title').textContent = chat ? 'How can I help you today?' : 'What would you like to get done?';
    A.$('.ph-sub').textContent = chat
      ? (r.id === 'general' ? 'Ask anything, create an image, look something up, or get a PDF or Word document.' : `You're chatting with your ${r.name}. Ask anything, create an image, look something up, or get a PDF or Word document.`)
      : 'Choose an assistant. Share an idea. Let’s make progress.';
    A.$('#proStarters').innerHTML = chat ? starters().map((x, i) => `<button type="button" class="ps-chip" data-start="${i}">${A.icon(x.ico)}<span>${A.esc(x.t)}</span></button>`).join('') : '';
  }

  function openTask(i) {
    const t = role().tasks[i]; if (!t) return;
    if (t.tool) { activeTool[role().id] = t.tool; renderKit(true); scrollToKit(); setTimeout(() => { const f = A.$('#proKit .pk-form input, #proKit .pk-form select, #proKit .pk-form textarea'); if (f) f.focus({ preventScroll: true }); }, 350); return; }
    fillPrompt(t.p);
  }

  /* ---------------- Events ---------------- */
  function bind() {
    A.$('#proTasks').addEventListener('click', (e) => { const b = e.target.closest('[data-task]'); if (b) openTask(+b.dataset.task); });
    A.$('#proViewAll').addEventListener('click', () => { showAll = !showAll; renderWork(); });
    A.$('#proStarters').addEventListener('click', (e) => { const b = e.target.closest('[data-start]'); if (b) fillPrompt(starters()[+b.dataset.start].p); });
    const kit = A.$('#proKit');
    kit.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tool]'); if (tab) { activeTool[role().id] = tab.dataset.tool; renderKit(true); return; }
      const k = e.target.closest('[data-kit]'); if (k) kitAction(k.dataset.kit);
    });
    kit.addEventListener('keydown', (e) => {
      const tab = e.target.closest('[role=tab]'); if (!tab || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tabs = A.$$('[role=tab]', kit); const i = (tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      tabs[i].click(); A.$$('[role=tab]', kit)[i].focus();
    });
    const onInput = (e) => {
      const el = e.target; if (!el.dataset || !el.dataset.k) return;
      const id = el.closest('[data-toolform]').dataset.toolform; const v = valuesFor(id); const f = T[id].fields.find((x) => x.k === el.dataset.k);
      if (f.type === 'checks') v[f.k] = A.$$(`input[data-k="${f.k}"]`, el.closest('form')).filter((c) => c.checked).map((c) => c.value);
      else if (f.type === 'number') { const n = parseFloat(String(el.value).replace(/[,\s₱%]/g, '')); v[f.k] = Number.isFinite(n) ? n : 0; }
      else v[f.k] = el.value;
      saveVals(); renderOut();
    };
    kit.addEventListener('input', onInput); kit.addEventListener('change', onInput);
    kit.addEventListener('focusout', (e) => {
      const el = e.target; if (!el.dataset || !el.dataset.num) return;
      const id = el.closest('[data-toolform]').dataset.toolform; const f = T[id].fields.find((x) => x.k === el.dataset.k);
      el.value = fmtNum(valuesFor(id)[f.k], f);
    });
    // Keyboard navigation inside the role dropdown
    A.$('#popover').addEventListener('keydown', (e) => {
      if (!A.$('#popover .role-menu') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = A.$$('#popover .role-item'); let i = items.indexOf(document.activeElement);
      i = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      e.preventDefault(); items[i].focus();
    });
  }

  /* ---------------- Public API (used by app.js) ---------------- */
  window.GASPro = {
    init(api) {
      A = api;
      vals = A.store.get('pro:tools', {}) || {};
      Object.keys(vals).forEach((k) => { if (!T[k]) delete vals[k]; else vals[k] = Object.assign(defaults(k), vals[k]); });
      const saved = A.store.get('role', 'general'); roleId = roleById(saved) ? saved : 'general';
      bind();
    },
    onView() {
      if (!A) return;
      if (!isPro()) { A.$('#prompt').placeholder = 'How can I help you today?'; return; }
      paintRole();
      if (painted !== roleId) { renderTasks(); renderKit(); painted = roleId; }
      renderWork(); paintMode(); paintChrome();
    },
    beforeNewChat() { mode = toOverview ? 'overview' : 'chat'; toOverview = false; },
    onOpenConvo(c) { if (isPro() && c && c.role && roleById(c.role) && c.role !== roleId) setRole(c.role, true); },
    system() {
      if (!isPro()) return '';
      const r = role(); if (!r.persona) return '';
      return `Job model: ${r.name}. ${r.persona} If a request is outside this role, still help, using general knowledge.`;
    },
    roleId: () => (isPro() ? roleId : undefined),
    roleName: () => (isPro() && roleId !== 'general' ? role().name : ''),
    paletteItems: () => ALL.map((r) => ({ g: 'Job model', label: r.name, ico: r.ico, hint: r.id === roleId ? 'Current' : 'Switch role', run: () => { if (A.state.skin !== 'pro') location.hash = 'pro'; setTimeout(() => { A.newChat(); setRole(r.id); }, 30); } })),
    action(act, el) {
      if (!isPro()) return false;
      const map = { 'role-menu': () => roleMenu(el), 'job-menu': () => jobMenu(el), 'compose-menu': () => composeMenu(el), 'profile-menu': () => profileMenu(el), overview: () => { toOverview = true; A.newChat(); A.$('#chatScroll').scrollTo({ top: 0 }); } };
      if (!map[act]) return false; map[act](); return true;
    },
    roles: ALL, tools: T,
  };
})();
