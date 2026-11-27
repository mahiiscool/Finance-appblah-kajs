'use strict';
(function () {
  const C = Core, V = Vault;
  let S = null;
  let ui = { tab: 'home', bview: 'week', wOff: 0, mk: null, more: null, imp: null, bmk: null, rmk: null, hist: 40, lastCat: 'food', pendingBackup: null };
  let hiddenAt = 0, saveT = null, dirty = false;

  // ---------- helpers ----------
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const fm = (n) => C.money(n);
  const mahi = () => !S || S.persona !== 'blank';
  const catOpts = (sel) => S.cats.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('') + '<option value="__hh">Household (ignored)</option>';
  const pad = (n) => String(n).padStart(2, '0');
  const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  const MIN5 = 5 * 60 * 1000;

  const ICON = {
    gear: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-8"/><path d="M3 20h18"/></svg>',
    people: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 4.5 2 4.5 5"/></svg>',
    target: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>'
  };

  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
  }

  // ---------- default data ----------
  function defaultState() {
    const amounts = { gas: 150, insurance: 200, flexpay: 53.66, dad: 136.82, phone: 54, gym: 25, haircut: 42, subs: 41.99, food: 0, fun: 0, shop: 0, amazon: 0, other: 0 };
    return {
      v: 1, persona: 'mahi', mode: 'school',
      cats: [
        { id: 'gas', name: 'Gas', kind: 'fixed' }, { id: 'insurance', name: 'Car insurance', kind: 'fixed' },
        { id: 'flexpay', name: 'Flex pay', kind: 'fixed' }, { id: 'dad', name: "Dad's payment", kind: 'fixed' },
        { id: 'phone', name: 'Phone', kind: 'fixed' }, { id: 'gym', name: 'Gym', kind: 'fixed' },
        { id: 'haircut', name: 'Haircut', kind: 'fixed' }, { id: 'subs', name: 'Subscriptions', kind: 'fixed' },
        { id: 'food', name: 'Food', kind: 'flex' }, { id: 'fun', name: 'Fun and going out', kind: 'flex' }, { id: 'shop', name: 'Shopping', kind: 'flex' }, { id: 'amazon', name: 'Amazon essentials', kind: 'flex' },
        { id: 'other', name: 'Other', kind: 'flex' }
      ],
      budget: {
        school: { amounts: Object.assign({}, amounts), foodWeek: 60, income: 1300, savings: { mom: 150, gen: 106.53 } },
        summer: { amounts: Object.assign({}, amounts), foodWeek: 60, pay: 0, freq: 'biweekly', savings: { mom: 300, trip: 200, gen: 300 } }
      },
      accounts: [{ id: 'chk', name: 'Checking', last4: '', type: 'checking', balance: 0 }],
      expenses: [], ious: [],
      goals: {
        mom: { name: 'Mom payback', target: 0, contribs: [] },
        ins: { name: 'Insurance fund', target: 1200, due: '', start: '', contribs: [] },
        trip: { name: 'Trip fund', target: 0, contribs: [] },
        gen: { name: 'General savings', target: 0, contribs: [] }
      },
      bills: [
        { id: 'b1', name: 'Car insurance fund', amount: 200, day: null, cat: 'insurance' },
        { id: 'b2', name: 'Flex pay', amount: 53.66, day: null, cat: 'flexpay' },
        { id: 'b3', name: "Dad's payment", amount: 136.82, day: null, cat: 'dad' },
        { id: 'b4', name: 'Phone', amount: 54, day: null, cat: 'phone' },
        { id: 'b5', name: 'Gym', amount: 25, day: null, cat: 'gym' },
        { id: 'b6', name: 'Windscribe', amount: 2, day: null, cat: 'subs' },
        { id: 'b7', name: 'Google Photos', amount: 2, day: null, cat: 'subs' },
        { id: 'b8', name: 'Spotify', amount: 12.99, day: null, cat: 'subs' },
        { id: 'b9', name: 'Snapchat Premium', amount: 5, day: null, cat: 'subs' },
        { id: 'b10', name: 'Claude', amount: 20, day: null, cat: 'subs' }
      ],
      household: { items: [
        { id: 'h1', name: 'Family phone plan', amount: 181.83 }, { id: 'h2', name: 'DTE', amount: 195 },
        { id: 'h3', name: 'Water', amount: 182 }, { id: 'h4', name: 'SBA loan', amount: 200 },
        { id: 'h5', name: 'Citi card', amount: 60 }, { id: 'h6', name: 'Xfinity', amount: 70 }
      ], deposits: {} },
      rules: [
        { match: 'subway', cat: 'food' }, { match: 'holy bowly', cat: 'food' }, { match: 'bowls n bites', cat: 'food' },
        { match: 'amazon', cat: 'amazon' }, { match: 'amzn', cat: 'amazon' },
        { match: 'shell', cat: 'gas' }, { match: 'costco gas', cat: 'gas' }
      ],
      paySource: 'checking', csvMap: null, lastBackup: null, lastAccount: 'chk', dismissed: {},
      autoBal: true, balSince: null, rollover: false, rollSince: null, overCarry: true, overSince: null, payFreq: 'biweekly', paychecks: [], transfers: [], setupV: 0
    };
  }

  function blankState() {
    const s = defaultState();
    s.persona = 'blank';
    s.cats = s.cats.filter((c) => c.id !== 'flexpay' && c.id !== 'dad');
    s.cats.find((c) => c.id === 'haircut').name = 'Personal care';
    s.cats.find((c) => c.id === 'amazon').name = 'Online orders';
    ['school', 'summer'].forEach((m) => {
      const b = s.budget[m];
      Object.keys(b.amounts).forEach((k) => { b.amounts[k] = 0; });
      Object.keys(b.savings).forEach((k) => { b.savings[k] = 0; });
      b.foodWeek = 0;
      if (m === 'school') b.income = 0;
    });
    s.goals.mom.name = 'Payback';
    s.goals.ins.target = 0;
    s.bills = []; s.household.items = []; s.rules = [];
    return s;
  }

  // ---------- persistence ----------
  function save() { dirty = true; clearTimeout(saveT); saveT = setTimeout(flush, 350); }
  async function flush() {
    clearTimeout(saveT);
    if (dirty && S && V.isUnlocked()) {
      dirty = false;
      try { await V.save(S); } catch (e) { toast('Could not save. Try backing up.'); }
    }
  }

  // ---------- data helpers ----------
  const budgetOf = (m) => S.budget[m || S.mode];
  const catName = (id) => { if (id === '__hh') return 'Household (ignored)'; const c = S.cats.find((x) => x.id === id); return c ? c.name : 'Other'; };
  const counted = (e) => !e.paidFromSavings && !e.forOther && !e.household;
  function incomeOf(mode) {
    const b = S.budget[mode];
    if (mode === 'school') return b.income;
    const f = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 }[b.freq] || 1;
    return C.round2(b.pay * f);
  }
  const plannedSpend = () => C.round2(sum(S.cats.filter((c) => c.kind === 'fixed'), (c) => budgetOf().amounts[c.id] || 0) + poolMonth());
  const plannedSavings = () => sum(Object.values(budgetOf().savings));
  function monthSpend(mk) {
    const m = {};
    S.expenses.forEach((e) => { if (counted(e) && C.monthKey(e.date) === mk) m[e.cat] = (m[e.cat] || 0) + e.amount; });
    return m;
  }
  // One weekly "spending money" limit covers every flexible category (food, shopping, other).
  // Fixed categories are bills with their own monthly amounts.
  const isFlex = (cat) => { const c = S.cats.find((x) => x.id === cat); return !c || c.kind === 'flex'; };
  const poolMonth = (m) => C.round2((budgetOf(m).foodWeek || 0) * 52 / 12);
  // The weekly spending money card, used on Home and in Budget > Week.
  function weekHero(ws, isNow) {
    const b = budgetOf(), we = C.addDays(ws, 6), fw = weekLimit(ws), sp = weekSpend(ws), left = C.round2(fw - sp), pct = fw > 0 ? sp / fw : (fw < 0 || sp > 0 ? 1 : 0);
    const t = C.today(), days = daysToSunday();
    const today = sum(S.expenses.filter((e) => counted(e) && isFlex(e.cat) && e.date === t), (e) => e.amount);
    let h = ring(pct, C.status(pct), fm(left), left < 0 ? 'over' : 'left this week');
    if (isNow) {
      h += left > 0 ? `<p class="tc med">${fm(left / days)} a day for the next ${days} day${days === 1 ? '' : 's'}</p>` : `<p class="tc med r">${fm(-left)} over. Try to spend nothing until Sunday.</p>`;
      h += `<p class="tc muted">${fm(sp)} of ${fm(fw)} spent. Today: ${fm(today)}.</p>`;
    } else h += `<p class="tc muted">${fm(sp)} of ${fm(fw)} spent, ${C.shortDate(ws)} to ${C.shortDate(we)}.</p>`;
    const cv = coverOf(ws);
    if (cv) h += `<p class="tc muted small">Includes ${fm(cv)} covered by savings.</p>`;
    if (fw - cv > b.foodWeek) h += `<p class="tc muted small">Includes ${fm(fw - cv - b.foodWeek)} rolled over from earlier weeks.</p>`;
    else if (fw - cv < b.foodWeek) h += `<p class="tc small y">${fm(b.foodWeek - fw + cv)} taken out to cover overspending from earlier weeks.</p>`;
    const need = coverNeed(ws);
    if (isNow && need >= 1 && (fw <= 0 || sp - fw >= b.foodWeek / 2 || b.foodWeek - fw >= b.foodWeek / 2)) h += `<button class="mt btn" data-act="coverSheet" data-ws="${ws}">Cover ${fm(need)} with savings</button>`;
    return h;
  }
  // ---------- money left over each month goes to savings ----------
  const LO = () => (S.leftover = S.leftover || { start: C.monthKey(C.today()), before: 0, moved: {} });
  function monthIncome(mk) { const p = sum((S.paychecks || []).filter((x) => C.monthKey(x.date) === mk), (x) => x.amount); return p > 0 ? C.round2(p) : incomeOf(S.mode); }
  const monthOut = (mk) => C.round2(sum(S.expenses.filter((e) => counted(e) && C.monthKey(e.date) === mk), (e) => e.amount));
  const leftoverOf = (mk) => C.round2(monthIncome(mk) - monthOut(mk));
  // This month, assuming every bill gets paid and all the weekly money gets spent.
  function projectedLeftover(mk) {
    const b = budgetOf(), ms = monthSpend(mk);
    const fixedLeft = sum(S.cats.filter((c) => c.kind === 'fixed'), (c) => Math.max(0, (b.amounts[c.id] || 0) - (ms[c.id] || 0)));
    const flexLeft = Math.max(0, poolMonth() - sum(S.cats.filter((c) => c.kind === 'flex'), (c) => ms[c.id] || 0));
    return C.round2(monthIncome(mk) - monthOut(mk) - fixedLeft - flexLeft);
  }
  function savedThisYear() {
    const lo = LO(), cur = C.monthKey(C.today()), yr = cur.slice(0, 4), months = [];
    for (let mk = lo.start > yr + '-01' ? lo.start : yr + '-01'; mk < cur; mk = C.shiftMonthKey(mk, 1)) months.push({ mk, v: leftoverOf(mk) });
    const before = lo.start.slice(0, 4) === yr ? lo.before || 0 : 0;
    return { total: C.round2(before + sum(months, (m) => m.v)), months, before };
  }
  function savingsCard() {
    const lo = LO(), cur = C.monthKey(C.today()), y = savedThisYear(), proj = projectedLeftover(cur), last = C.shiftMonthKey(cur, -1);
    let inner = `<p class="big g">${fm(y.total)}</p><p class="muted">Saved in ${cur.slice(0, 4)} from money left over each month.</p>`;
    inner += `<div class="row item"><span>${C.monthName(cur)}, on track to save</span><b class="${proj < 0 ? 'r' : 'g'}">${proj < 0 ? fm(proj) + ' short' : fm(proj)}</b></div>`;
    inner += `<p class="muted small">If you pay every bill and spend all your weekly money. Every dollar of the ${fm(budgetOf().foodWeek)} a week you skip adds to it.${cur < lo.start ? ' Tracking starts ' + C.monthName(lo.start) + '.' : ''}</p>`;
    if (y.months.length || y.before) inner += '<p class="label mt">This year</p>' + (y.before ? `<div class="row item"><span>Before tracking</span><b>${fm(y.before)}</b></div>` : '') +
      y.months.slice().reverse().map((m) => `<div class="row item"><span>${C.monthName(m.mk)}${lo.moved[m.mk] !== undefined ? '<span class="pill g">Moved</span>' : ''}</span><b class="${m.v < 0 ? 'r' : 'g'}">${m.v < 0 ? fm(m.v) + ' short' : fm(m.v)}</b></div>`).join('');
    const lv = leftoverOf(last);
    if (last >= lo.start && lo.moved[last] === undefined && lv > 0) inner += `<div class="card inset"><p class="med">${C.monthName(last)} left you ${fm(lv)}</p><p class="muted small">Move it from checking to savings, then tap below.</p><button class="mt8 btn primary" data-act="moveLeftover" data-mk="${last}">I moved it to savings</button></div>`;
    inner += `<p class="muted small mt8">Bonus this month: ${fm(bonusInMonth(cur))}. Bonus money goes straight to a goal.</p><button class="mt8 btn" data-act="logBonus">Log bonus</button>`;
    return card('Savings', inner);
  }
  // Where this week's spending money went, by type.
  function weekBreakdown(ws) {
    const we = C.addDays(ws, 6), by = {};
    S.expenses.forEach((e) => { if (counted(e) && isFlex(e.cat) && e.date >= ws && e.date <= we) by[e.cat] = (by[e.cat] || 0) + e.amount; });
    const keys = Object.keys(by).sort((a, c) => by[c] - by[a]); if (!keys.length) return '';
    const tot = sum(keys, (k) => by[k]);
    return '<p class="label mt">Where it went</p>' + keys.map((k) => `<div class="rline"><div class="row"><span>${esc(catName(k))}</span><b>${fm(by[k])} <span class="muted small">${Math.round(by[k] / tot * 100)}%</span></b></div>${bar(by[k] / tot, 'b')}</div>`).join('');
  }
  function gasCard() {
    const gas = S.cats.find((c) => c.id === 'gas'); if (!gas) return '';
    const t = C.today(), mk = C.monthKey(t), lim = budgetOf().amounts.gas || 0;
    const fills = S.expenses.filter((e) => counted(e) && e.cat === 'gas' && C.monthKey(e.date) === mk).sort((a, c) => (a.date < c.date ? 1 : -1));
    if (!lim && !fills.length) return '';
    const sp = C.round2(sum(fills, (e) => e.amount)), day = +t.slice(8), days = dim(mk), pace = C.round2(sp / day * days);
    const pct = lim ? sp / lim : 0, cls = C.status(pct);
    let inner = `<p class="big ${sp > lim && lim ? 'r' : ''}">${fm(sp)} <span class="muted med">of ${fm(lim)}</span></p>${lim ? bar(pct, cls) : ''}`;
    if (fills.length) {
      inner += `<p class="muted">${fills.length} fill up${fills.length === 1 ? '' : 's'}, about ${fm(sp / fills.length)} each. Last one ${C.shortDate(fills[0].date)}.</p>`;
      if (lim) inner += sp > lim ? `<p class="r">${fm(sp - lim)} over your gas budget.</p>` : day >= 7 ? `<p class="${pace > lim ? 'y' : 'g'}">On pace for ${fm(pace)} this month${pace > lim ? ', ' + fm(pace - lim) + ' over' : ', so about ' + fm(lim - pace) + ' goes to savings'}.</p>` : `<p class="muted">${fm(lim - sp)} left for gas this month.</p>`;
    } else inner += '<p class="muted">No fill ups logged this month.</p>';
    const prev = [1, 2, 3].map((n) => { const k = C.shiftMonthKey(mk, -n); return { k, v: monthSpend(k).gas || 0 }; }).filter((x) => x.v > 0);
    if (prev.length) inner += '<p class="label mt">Past months</p>' + prev.map((x) => `<div class="row item"><span>${C.monthName(x.k)}</span><b class="${lim && x.v > lim ? 'r' : ''}">${fm(x.v)}${lim ? ` <span class="small ${x.v > lim ? 'r' : 'g'}">${x.v > lim ? fm(x.v - lim) + ' over' : fm(lim - x.v) + ' saved'}</span>` : ''}</b></div>`).join('');
    if (lim) inner += '<p class="muted small mt8">Gas money you do not use goes to your savings at the end of the month.</p>';
    return card('Gas this month', inner + '<button class="mt btn primary" data-act="logGas">Log a fill up</button>');
  }
  // Past full weeks of spending money, newest first.
  function pastWeeks(n) {
    const out = [], cur = C.weekStart(C.today());
    const flexDates = S.expenses.filter((e) => counted(e) && isFlex(e.cat)).map((e) => e.date).sort();
    if (!flexDates.length) return out;
    const first = C.weekStart(flexDates[0]);
    for (let i = 1; i <= n; i++) {
      const ws = C.addDays(cur, -7 * i);
      if (ws < first) break;
      out.push({ ws, sp: weekSpend(ws), lim: weekLimit(ws) });
    }
    return out;
  }
  function weekSpend(ws, cat) {
    const we = C.addDays(ws, 6);
    return sum(S.expenses.filter((e) => counted(e) && (cat ? e.cat === cat : isFlex(e.cat)) && e.date >= ws && e.date <= we), (e) => e.amount);
  }
  function daysToSunday() { const d = new Date().getDay(); return (7 - d) % 7 || 7; }
  function goalTotal(k) {
    const g = S.goals[k];
    let t;
    if (k === 'ins') {
      const st = g.start || '0000-00-00';
      t = sum(g.contribs.filter((c) => c.date >= st), (c) => c.amount) +
        sum(S.expenses.filter((e) => e.cat === 'insurance' && counted(e) && e.date >= st), (e) => e.amount);
    } else t = sum(g.contribs, (c) => c.amount);
    if (k === 'mom') t += sum(S.expenses.filter((e) => e.cat === 'mompay' && counted(e)), (e) => e.amount);
    if (k === 'gen') t -= sum(S.expenses.filter((e) => e.paidFromSavings), (e) => e.amount);
    return C.round2(t);
  }
  function savedInMonth(mk) {
    return sum(['mom', 'trip', 'gen'], (k) => sum(S.goals[k].contribs.filter((c) => C.monthKey(c.date) === mk && !c.bonus), (c) => c.amount));
  }
  function bonusInMonth(mk) {
    return sum(Object.keys(S.goals), (k) => sum(S.goals[k].contribs.filter((c) => C.monthKey(c.date) === mk && c.bonus), (c) => c.amount));
  }
  const remaining = (i) => C.round2(i.amount - sum(i.payments, (p) => p.amount));
  const billPaid = (b, mk) => S.expenses.some((e) => e.billId === b.id && C.monthKey(e.date) === mk);
  const dim = (mk) => { const p = mk.split('-').map(Number); return new Date(p[0], p[1], 0).getDate(); };
  const dueDate = (mk, day) => mk + '-' + pad(Math.min(day, dim(mk)));
  function nextBill() {
    const t = C.today(), mk = C.monthKey(t); let best = null;
    S.bills.forEach((b) => {
      if (!b.day) return;
      const paid = billPaid(b, mk);
      const date = paid ? dueDate(C.shiftMonthKey(mk, 1), b.day) : dueDate(mk, b.day);
      if (!best || date < best.date) best = { b, date, overdue: !paid && date < t };
    });
    return best;
  }
  function takeoutStreak() {
    const t = C.today();
    const list = S.expenses.filter((e) => !e.household && (e.takeout || e.cat === 'food')).map((e) => e.date).sort();
    if (list.length) return { days: Math.max(0, C.daysBetween(list[list.length - 1], t)), has: true };
    const all = S.expenses.map((e) => e.date).sort();
    return { days: all.length ? C.daysBetween(all[0], t) : 0, has: false };
  }
  const cardsOwed = () => sum(S.accounts.filter((a) => a.type === 'card'), (a) => a.balance);
  const checking = () => sum(S.accounts.filter((a) => a.type === 'checking'), (a) => a.balance);
  const payType = () => (S.paySource === 'savings' ? 'savings' : 'checking');
  const payPool = () => sum(S.accounts.filter((a) => a.type === payType()), (a) => a.balance);
  const payName = () => (payType() === 'savings' ? 'Savings' : 'Checking');

  // Balances follow purchases logged on or after the day automatic balances started.
  function applyBal(e) {
    if (!S.autoBal || e.bal || !S.balSince || e.date < S.balSince) return;
    const a = S.accounts.find((x) => x.id === e.account); if (!a) return;
    const d = a.type === 'card' ? e.amount : -e.amount;
    a.balance = C.round2((a.balance || 0) + d); e.bal = { id: a.id, d };
  }
  function revertBal(e) {
    if (!e.bal) return;
    const a = S.accounts.find((x) => x.id === e.bal.id); if (a) a.balance = C.round2((a.balance || 0) - e.bal.d);
    delete e.bal;
  }
  const PER_MONTH = { weekly: 52 / 12, biweekly: 26 / 12, semimonthly: 2, monthly: 1 };
  const DAYS_PER = { weekly: 7, biweekly: 14, semimonthly: 15, monthly: 30 };
  const FREQS = [['weekly', 'Every week'], ['biweekly', 'Every two weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Once a month']];
  const payFreq = () => (S.mode === 'summer' ? S.budget.summer.freq : S.payFreq) || 'biweekly';
  const perCheck = () => (S.mode === 'summer' ? S.budget.summer.pay || 0 : C.round2(incomeOf('school') / PER_MONTH[payFreq()]));
  // Weekly spending money limit. Unspent money carries forward when rollover is on (up to one week's worth),
  // and overspending carries forward as a smaller limit next week when overspend carry is on.
  function weekLimit(ws) {
    const base = budgetOf().foodWeek || 0;
    const rs = S.rollover && S.rollSince ? C.weekStart(S.rollSince) : null;
    const os = S.overCarry && S.overSince ? C.weekStart(S.overSince) : null;
    const cov = coverOf(ws);
    if (!base || (!rs && !os)) return C.round2(base + cov);
    let w = rs && os ? (rs < os ? rs : os) : rs || os; const early = C.addDays(ws, -84); if (w < early) w = early;
    let carry = 0;
    for (; w < ws; w = C.addDays(w, 7)) {
      const left = C.round2(base + carry + coverOf(w) - weekSpend(w));
      if (left >= 0) carry = rs && w >= rs ? Math.min(base, left) : 0;
      else carry = os && w >= os ? left : 0;
    }
    return C.round2(base + carry + cov);
  }
  // Money moved from savings to cover a big overspend in a given week.
  const coverOf = (ws) => C.round2(sum((S.covers || []).filter((c) => c.ws === ws), (c) => c.amount));
  // How much it takes to get a week back on track: undo the cut from earlier weeks and clear any overage.
  function coverNeed(ws) {
    const base = budgetOf().foodWeek || 0, fw = weekLimit(ws), sp = weekSpend(ws);
    return C.round2(Math.max(0, base - fw, sp - fw));
  }
  const SUB_DAYS = 90;
  const subsDue = () => S.bills.filter((b) => b.cat === 'subs' && (!b.reviewed || C.daysBetween(b.reviewed, C.today()) >= SUB_DAYS));
  function lastPaid(b) { const l = S.expenses.filter((e) => e.billId === b.id).map((e) => e.date).sort(); return l[l.length - 1] || null; }
  function setupGaps() {
    const g = [], nd = S.bills.filter((b) => !b.day).length;
    if (!incomeOf(S.mode)) g.push(['Add your income', 'budgetEdit']);
    if (nd) g.push([nd + ' bill' + (nd === 1 ? ' has' : 's have') + ' no due day', 'bills']);
    if (!budgetOf().foodWeek) g.push(['Set your weekly spending money', 'budgetEdit']);
    if (!S.accounts.some((a) => a.balance)) g.push(['Enter your account balances', 'cards']);
    return g;
  }

  // ---------- small UI parts ----------
  const bar = (pct, cls) => `<div class="bar"><div class="fill ${cls}" data-w="${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}"></div></div>`;
  function ring(pct, cls, big, small) {
    const r = 90, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return `<div class="ringwrap"><svg class="ringsvg" viewBox="0 0 210 210"><circle class="rtrack" cx="105" cy="105" r="${r}"/><circle class="rfill ${cls}" cx="105" cy="105" r="${r}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 105 105)"/></svg><div class="ringtext"><div class="big">${big}</div><div class="muted small">${small}</div></div></div>`;
  }
  const card = (label, inner, cls) => `<div class="card ${cls || ''}">${label ? `<p class="label">${label}</p>` : ''}${inner}</div>`;
  const monthNav = (mk, act) => `<div class="mb14 row"><button class="btn small" data-act="${act}" data-d="-1">Previous</button><div class="m0 med tc f1 navt">${C.monthName(mk)}</div><button class="btn small" data-act="${act}" data-d="1">Next</button></div>`;
  const back = () => '<button class="back" data-act="moreBack">Back</button>';

  // ---------- render ----------
  function render() {
    if (!S) return;
    const y = window.scrollY;
    let body;
    switch (ui.tab) {
      case 'home': body = Home(); break;
      case 'budget': body = BudgetTab(); break;
      case 'ious': body = IOUs(); break;
      case 'goals': body = Goals(); break;
      default: body = More();
    }
    const tabs = [['home', 'Home', ICON.home], ['budget', 'Budget', ICON.chart], ['add'], ['ious', 'IOUs', ICON.people], ['goals', 'Goals', ICON.target], ['more', 'More', ICON.more]];
    $('#app').innerHTML = `<div class="screen">${body}</div>` +
      `<nav class="tabbar">${tabs.map((t) => t[0] === 'add' ? '<button class="addtab" data-act="add" aria-label="Add expense"><span class="plus">+</span><span>Add</span></button>' : `<button class="${ui.tab === t[0] ? 'on' : ''}" data-act="tab" data-t="${t[0]}">${t[0] === 'more' && logUnread() ? '<i class="ndot"></i>' : ''}${t[2]}<span>${t[1]}</span></button>`).join('')}</nav>`;
    applyWidths();
    window.scrollTo(0, y);
  }
  function applyWidths() { document.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; }); }

  // ---------- HOME ----------
  function Home() {
    const t = C.today(), mk = C.monthKey(t), b = budgetOf();
    let h = `<div class="head"><h1 class="title">Home</h1><button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button></div><div class="sub">${C.longDate(t)}</div>`;
    h += `<div class="seg"><button class="${S.mode === 'school' ? 'on' : ''}" data-act="mode" data-m="school">School year</button><button class="${S.mode === 'summer' ? 'on' : ''}" data-act="mode" data-m="summer">Summer</button></div>`;

    const ws = C.weekStart(t);
    h += card('Spending money this week', weekHero(ws, true) + weekBreakdown(ws) + '<div class="btns"><button class="btn" data-act="weekDetail">This week</button><button class="btn primary" data-act="add">Log spending</button></div>');
    if (new Date().getDay() === 0 && !S.dismissed['sun' + t]) {
      const open = S.ious.filter((i) => !i.settled).length;
      h += card('Sunday review', `<p class="med">Review the week and settle up</p>${(() => { const w = pastWeeks(1)[0]; return w ? `<p class="${w.sp > w.lim ? 'r' : 'g'}">Last week: ${fm(w.sp)} of ${fm(w.lim)}, ${fm(Math.abs(w.lim - w.sp))} ${w.sp > w.lim ? 'over' : 'under'}.</p>` : ''; })()}<p class="muted">${open ? open + ' open IOU' + (open === 1 ? '' : 's') + ' to look at.' : 'No open IOUs.'}</p><div class="btns"><button class="btn" data-act="sundayWeek">Last week's report</button><button class="btn" data-act="sundayIous">IOUs</button></div><button class="mt btn" data-act="dismissSun">Dismiss</button>`, 'note');
    }
    if (S.setupDone && (S.setupV || 0) < 2 && !S.dismissed.v2) {
      h += card('Finish setting up', `<p class="med">New setup steps were added</p><p class="muted">Pay schedule, each credit card, bill due dates, and savings goals. It takes about 3 minutes and fills in everything the app uses.</p><div class="btns"><button class="btn" data-act="dismissV2">Not now</button><button class="btn primary" data-act="quickSetup">Finish setup</button></div>`, 'note');
    } else if (S.setupV >= 2 && !S.dismissed['gap' + C.monthKey(t)]) {
      const gaps = setupGaps();
      if (gaps.length) h += card('Still missing', gaps.map((x) => `<button class="mrow" data-act="openMore" data-v="${x[1]}"><span>${x[0]}</span><span class="chev">&rsaquo;</span></button>`).join('') + '<button class="mt btn small" data-act="dismissGaps">Hide for this month</button>');
    }
    const lb = S.lastBackup;
    if ((S.expenses.length || S.setupDone) && (!lb || C.daysBetween(lb, t) >= 7) && !S.dismissed['bk' + t]) {
      h += card('Back up your data', `<p class="med">${lb ? 'It has been ' + C.daysBetween(lb, t) + ' days since your last backup.' : 'You have not backed up yet.'}</p><p class="muted small">Your data only lives on this phone. If Safari clears it or you lose the phone, a backup is the only way to get it back. Save the file to iCloud Drive.</p><div class="btns"><button class="btn" data-act="dismissBackup">Tomorrow</button><button class="btn primary" data-act="exportBackup">Back up now</button></div>`, lb ? '' : 'warn');
    }
    if (cardsOwed() > payPool() && cardsOwed() > 0) {
      h += card('Card warning', `<p class="med r">Cards owe ${fm(cardsOwed())}</p><p>${payName()} has ${fm(payPool())}. You are short ${fm(cardsOwed() - payPool())} before you pay them off.</p>`, 'warn');
    }

    h += gasCard();
    const pw = pastWeeks(4), under = pw.filter((w) => w.sp <= w.lim).length;
    if (pw.length) h += card('Recent weeks', `<p class="med">${under} of ${pw.length} week${pw.length === 1 ? '' : 's'} under ${fm(budgetOf().foodWeek)}</p>` + pw.map((w) => `<div class="row item"><span>${C.shortDate(w.ws)}</span><b class="${w.sp > w.lim ? 'r' : 'g'}">${fm(w.sp)} <span class="muted small">${w.sp > w.lim ? fm(w.sp - w.lim) + ' over' : fm(w.lim - w.sp) + ' under'}</span></b></div>`).join(''));

    const billsDue = S.bills, paidN = billsDue.filter((x) => billPaid(x, mk)).length, unpaid = sum(billsDue.filter((x) => !billPaid(x, mk)), (x) => x.amount);
    if (billsDue.length) h += card('Bills this month', `<p class="med">${paidN} of ${billsDue.length} paid</p>${bar(paidN / billsDue.length, paidN === billsDue.length ? 'g' : 'b')}<p class="muted">${unpaid > 0 ? fm(unpaid) + ' still to pay from your monthly income.' : 'All paid. Nothing else to plan this month.'}</p><button class="mt8 btn small" data-act="openMore" data-v="bills">Recurring bills</button>`);

    h += savingsCard();

    const owed = S.ious.filter((i) => !i.settled && i.dir === 'owedToMe');
    const od = owed.filter((i) => C.daysBetween(i.date, t) > 14).length;
    h += card('Owed to me', `<p class="big">${fm(sum(owed, remaining))}</p><p class="${od ? 'r' : 'muted'}">${od ? od + ' unpaid for over 14 days' : owed.length + ' open'}</p>`);

    const nb = nextBill();
    h += card('Next bill due', nb ? `<p class="med ${nb.overdue ? 'r' : ''}">${esc(nb.b.name)}, ${fm(nb.b.amount)}</p><p class="muted">${nb.overdue ? 'Overdue since ' : 'Due '}${C.shortDate(nb.date)}</p>` : '<p class="muted">Set due days in Recurring bills to see this.</p><button class="mt btn" data-act="openMore" data-v="bills">Recurring bills</button>');

    const sd = subsDue();
    if (sd.length && !S.dismissed['subs' + mk]) h += card('Subscription check', `<p class="med">${sd.length} subscription${sd.length === 1 ? '' : 's'} to review</p><p class="muted">${esc(sd.slice(0, 3).map((b) => b.name).join(', '))}${sd.length > 3 ? ' and more' : ''}. Still using ${sd.length === 1 ? 'it' : 'them'}?</p><div class="btns"><button class="btn" data-act="dismissSubs">Later</button><button class="btn primary" data-act="openMore" data-v="bills">Review</button></div>`);
    const st = takeoutStreak();
    h += card('Takeout streak', `<p class="big">${st.days} day${st.days === 1 ? '' : 's'}</p><p class="muted">${st.has ? 'Since your last food purchase.' : 'No food logged yet.'}</p>`);

    h += `<button class="mb14 btn primary" data-act="paycheck">I got paid</button><div class="btns"><button class="btn" data-act="openMore" data-v="afford">Can I afford this?</button><button class="btn" data-act="openMore" data-v="recap">Reports</button></div>`;
    return h;
  }

  // ---------- BUDGET ----------
  function BudgetTab() {
    let h = `<div class="head"><h1 class="title">Budget</h1></div><div class="sub">${S.mode === 'school' ? 'School year' : 'Summer'} mode</div>`;
    h += `<div class="seg">${[['week', 'Week'], ['month', 'Month'], ['hist', 'History']].map((v) => `<button class="${ui.bview === v[0] ? 'on' : ''}" data-act="bview" data-v="${v[0]}">${v[1]}</button>`).join('')}</div>`;
    if (ui.bview === 'week') h += WeekView(); else if (ui.bview === 'month') h += MonthView(); else h += HistView();
    return h;
  }
  function WeekView() {
    const ws = C.weekStart(C.addDays(C.today(), ui.wOff * 7)), we = C.addDays(ws, 6), b = budgetOf();
    let h = `<div class="mb14 row"><button class="btn small" data-act="wnav" data-d="-1">Previous</button><div class="tc f1 muted">${C.shortDate(ws)} to ${C.shortDate(we)}</div><button class="btn small" data-act="wnav" data-d="1">Next</button></div>`;
    h += card('Spending money', weekHero(ws, ui.wOff === 0) + weekBreakdown(ws));
    const list = S.expenses.filter((e) => counted(e) && isFlex(e.cat) && e.date >= ws && e.date <= we).sort((a, c) => (a.date < c.date ? 1 : -1));
    h += card('Spent this week', list.length ? list.map(expRow).join('') : '<p class="muted">Nothing logged yet.</p>');
    const pw = pastWeeks(8);
    if (pw.length) {
      const avg = sum(pw, (w) => w.sp) / pw.length, mx = Math.max(...pw.map((w) => Math.max(w.sp, w.lim)), 1);
      h += card('Past weeks', `<p class="muted">Average ${fm(avg)} a week. ${pw.filter((w) => w.sp <= w.lim).length} of ${pw.length} under the limit.</p>` + pw.map((w) => `<div class="rline"><div class="row"><span>${C.shortDate(w.ws)}</span><b class="${w.sp > w.lim ? 'r' : ''}">${fm(w.sp)} <span class="muted small">of ${fm(w.lim)}</span></b></div>${bar(w.sp / mx, w.sp > w.lim ? 'r' : 'g')}</div>`).join(''));
    }
    return h;
  }
  function MonthView() {
    const mk = ui.mk || C.monthKey(C.today()), b = budgetOf(), ms = monthSpend(mk);
    let h = monthNav(mk, 'mnav');
    const flexSp = sum(S.cats.filter((c) => c.kind === 'flex'), (c) => ms[c.id] || 0), pm = poolMonth();
    const parts = S.cats.filter((c) => c.kind === 'flex' && ms[c.id]).map((c) => esc(c.name) + ' ' + fm(ms[c.id])).join(', ');
    const pp = pm ? flexSp / pm : (flexSp ? 2 : 0), pc = C.status(pp);
    const poolRow = `<div class="item"><div class="row"><span class="t">Spending money</span><span class="${pc}">${fm(flexSp)} of ${fm(pm)}</span></div>${bar(pp, pc)}<div class="muted small">${flexSp > pm ? fm(flexSp - pm) + ' over' : fm(pm - flexSp) + ' left'}${parts ? '. ' + parts : ''}</div></div>`;
    const rows = poolRow + S.cats.filter((c) => c.kind === 'fixed' && ((b.amounts[c.id] || 0) > 0 || (ms[c.id] || 0) > 0)).map((c) => {
      const amt = b.amounts[c.id] || 0, sp = ms[c.id] || 0, pct = amt ? sp / amt : (sp ? 2 : 0), cls = C.status(pct);
      return `<div class="item"><div class="row"><span class="t">${esc(c.name)}</span><span class="${cls}">${fm(sp)} of ${fm(amt)}</span></div>${bar(pct, cls)}<div class="muted small">${sp > amt ? fm(sp - amt) + ' over' : fm(amt - sp) + ' left'}</div></div>`;
    }).join('');
    h += card('Spent vs budget', rows);
    const fs = sum(S.expenses.filter((e) => e.paidFromSavings && C.monthKey(e.date) === mk), (e) => e.amount);
    const fo = sum(S.expenses.filter((e) => e.forOther && C.monthKey(e.date) === mk), (e) => e.amount);
    const hh = sum(S.expenses.filter((e) => e.household && C.monthKey(e.date) === mk), (e) => e.amount);
    if (fs || fo || hh) h += card('Not counted', `${hh ? `<div class="row"><span>Household, ignored</span><b>${fm(hh)}</b></div>` : ''}${fs ? `<div class="row"><span>Paid from savings</span><b>${fm(fs)}</b></div>` : ''}${fo ? `<div class="row"><span>Bought for others</span><b>${fm(fo)}</b></div>` : ''}`);
    return h;
  }
  function expRow(e) {
    const tags = (e.paidFromSavings ? '<span class="pill">Savings</span>' : '') + (e.household ? '<span class="pill">Household</span>' : '') + (e.forOther ? `<span class="pill y">For ${esc(e.forOther)}</span>` : '') + (e.receipt ? '<span class="pill">Receipt</span>' : '');
    return `<div class="ptr item" data-act="editExp" data-id="${e.id}"><div class="row"><span class="t">${esc(e.note || catName(e.cat))}${tags}</span><b>${fm(e.amount)}</b></div><div class="muted small">${C.shortDate(e.date)}, ${esc(catName(e.cat))}</div></div>`;
  }
  function histMatches() {
    const q = (ui.hq || '').trim().toLowerCase(), cat = ui.hcat || '', rng = ui.hrng || 'all', t = C.today();
    const since = rng === 'm' ? C.monthKey(t) + '-01' : rng === '30' ? C.addDays(t, -29) : rng === '90' ? C.addDays(t, -89) : '';
    const isAmt = /^\$?\d+(\.\d{1,2})?$/.test(q), qn = C.num(q);
    return S.expenses.filter((e) => (!cat || e.cat === cat) && (!since || e.date >= since) && (!q ||
      (e.note || '').toLowerCase().includes(q) || catName(e.cat).toLowerCase().includes(q) || (e.forOther || '').toLowerCase().includes(q) ||
      (isAmt && Math.abs(e.amount - qn) < 0.005))).sort((a, c) => (a.date < c.date ? 1 : a.date > c.date ? -1 : 0));
  }
  function histListHTML() {
    const list = histMatches(), filtered = ui.hq || ui.hcat || (ui.hrng && ui.hrng !== 'all');
    if (!list.length) return '<p class="muted">Nothing matches.</p>';
    return (filtered ? `<p class="muted small">${list.length} found, ${fm(sum(list, (e) => e.amount))} total</p>` : '') + list.slice(0, ui.hist).map(expRow).join('') +
      (list.length > ui.hist ? '<button class="mt btn" data-act="moreHist">Show more</button>' : '');
  }
  function HistView() {
    if (!S.expenses.length) return card('History', '<p class="muted">No expenses yet. Tap Add to log your first one.</p>');
    return card('Search', `<input type="search" id="hq" placeholder="Name, category, or amount" autocomplete="off" value="${esc(ui.hq || '')}"><div class="two mt8"><select id="hcat"><option value="">All categories</option>${S.cats.map((c) => `<option value="${c.id}" ${ui.hcat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><select id="hrng">${[['all', 'All time'], ['m', 'This month'], ['30', 'Last 30 days'], ['90', 'Last 90 days']].map((o) => `<option value="${o[0]}" ${(ui.hrng || 'all') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`) +
      card('History', `<div id="histlist">${histListHTML()}</div>`);
  }

  // ---------- IOUs ----------
  function IOUs() {
    const t = C.today();
    let h = `<div class="head"><h1 class="title">IOUs</h1></div><div class="sub">Who owes what</div>`;
    h += `<button class="mb16 btn primary" data-act="addIou">Add an IOU</button>`;
    const open = S.ious.filter((i) => !i.settled);
    const net = {};
    open.forEach((i) => { const k = i.person.trim().toLowerCase(); net[k] = net[k] || { name: i.person.trim(), v: 0 }; net[k].v += i.dir === 'owedToMe' ? remaining(i) : -remaining(i); });
    const people = Object.values(net);
    if (people.length) h += card('Net balance by person', people.map((p) => `<div class="row item"><span class="t">${esc(p.name)}</span><span class="${p.v > 0.004 ? 'g' : p.v < -0.004 ? 'r' : 'muted'}">${Math.abs(p.v) < 0.005 ? 'Even' : p.v > 0 ? 'Owes you ' + fm(p.v) : 'You owe ' + fm(p.v)}</span></div>`).join(''));
    const list = (dir, title) => {
      const items = open.filter((i) => i.dir === dir).sort((a, c) => (a.date < c.date ? -1 : 1));
      return card(title, items.length ? items.map((i) => {
        const age = C.daysBetween(i.date, t), late = age > 14;
        return `<div class="item"><div class="row"><span class="t ${late ? 'r' : ''}">${esc(i.person)}</span><b class="${late ? 'r' : ''}">${fm(remaining(i))}</b></div><div class="muted small">${esc(i.reason || 'No reason')}, ${C.shortDate(i.date)}${late ? `<span class="pill r">${age} days unpaid</span>` : ''}${i.payments.length ? `<span class="pill g">Paid ${fm(sum(i.payments, (p) => p.amount))} of ${fm(i.amount)}</span>` : ''}</div><div class="btns"><button class="btn small" data-act="payIou" data-id="${i.id}">Payment</button><button class="btn small" data-act="settleIou" data-id="${i.id}">Settle</button><button class="btn small danger" data-act="delIou" data-id="${i.id}">Delete</button></div></div>`;
      }).join('') : '<p class="muted">Nothing here.</p>');
    };
    h += list('owedToMe', 'They owe me') + list('iOwe', 'I owe them');
    const done = S.ious.filter((i) => i.settled).slice(-5).reverse();
    if (done.length) h += card('Recently settled', done.map((i) => `<div class="row item"><span>${esc(i.person)}, ${esc(i.reason || '')}</span><span class="muted">${fm(i.amount)}</span></div>`).join(''));
    return h;
  }

  // ---------- GOALS ----------
  function Goals() {
    const t = C.today(), b = budgetOf();
    let h = `<div class="head"><h1 class="title">Goals</h1></div><div class="sub">Savings and payback</div>`;
    h += `<button class="mb16 btn primary" data-act="logBonus">Log bonus</button>`;
    // mom
    const mom = S.goals.mom, momTot = goalTotal('mom'), momLeft = Math.max(0, mom.target - momTot), momMonthly = (b.amounts.mompay || 0) + (b.savings.mom || 0);
    h += goalCard('mom', mom.target ? `<p class="big">${fm(momLeft)} <span class="muted med">left of ${fm(mom.target)}</span></p>${bar(mom.target ? momTot / mom.target : 0, 'g')}<p class="muted">${momLeft === 0 ? 'Paid off.' : momMonthly ? Math.ceil(momLeft / momMonthly) + ' months left at ' + fm(momMonthly) + ' a month.' : 'Set a monthly amount in Budget and income.'}</p>` : `<p class="muted">Enter the total you owe to see months left at ${fm(momMonthly)} a month.</p><p>Paid back so far: <b>${fm(momTot)}</b></p>`);
    // insurance
    const ins = S.goals.ins, insTot = goalTotal('ins');
    let insLine = '<p class="muted">Set the due date to see what you need each month.</p>';
    if (ins.due) {
      const dd = C.daysBetween(t, ins.due), need = Math.max(0, ins.target - insTot);
      if (dd < 0) insLine = `<p class="r">Due date was ${C.shortDate(ins.due)}.</p>`;
      else { const months = Math.max(1, dd / 30.44); insLine = `<p class="muted">Due ${C.shortDate(ins.due)}, ${dd} days away. ${need > 0 ? 'Needs about ' + fm(need / months) + ' a month.' : 'Fully funded.'}</p>`; }
    }
    h += goalCard('ins', `<p class="big">${fm(insTot)} <span class="muted med">of ${fm(ins.target)}</span></p>${bar(ins.target ? insTot / ins.target : 0, C.status(0.5))}${insLine}<p class="muted small">Car insurance spending counts toward this.</p>${ins.due ? '<button class="mt8 btn" data-act="insNext">Bill paid, start next cycle</button>' : ''}`);
    // trip
    const trip = S.goals.trip, tripTot = goalTotal('trip');
    h += goalCard('trip', trip.target ? `<p class="big">${fm(tripTot)} <span class="muted med">of ${fm(trip.target)}</span></p>${bar(tripTot / trip.target, 'b')}` : `<p class="big">${fm(tripTot)}</p><p class="muted">Set a target in Edit if you want a progress bar.</p>`);
    // general
    h += goalCard('gen', `<p class="big">${fm(goalTotal('gen'))}</p><p class="muted small">After one time purchases paid from savings.</p>`);
    return h;
  }
  function goalCard(k, inner) {
    return card(S.goals[k].name, inner + `<div class="btns"><button class="btn small" data-act="contrib" data-k="${k}">Add</button><button class="btn small" data-act="goalHist" data-k="${k}">History</button><button class="btn small" data-act="goalEdit" data-k="${k}">Edit</button></div>`);
  }

  // ---------- MORE ----------
  // ---------- what's new ----------
  // The list lives in changelog.json in the repo, so every push updates it without changing the app code.
  let LOG = null, logBusy = false;
  const logTop = () => (LOG && LOG.length ? Math.max(...LOG.map((x) => x.v || 0)) : 0);
  const logUnread = () => !!(S && LOG && logTop() > (S.logSeen || 0));
  async function loadLog(rerender) {
    if (logBusy) return; logBusy = true;
    try {
      let res;
      try { res = await fetch('changelog.json', { cache: 'no-store' }); } catch (e) { res = await caches.match('changelog.json'); }
      if (res && res.ok) { const j = await res.json(); if (Array.isArray(j)) { const had = logTop(); LOG = j; if (rerender || logTop() !== had) render(); } }
    } catch (e) {}
    logBusy = false;
  }
  const LOG_TYPES = { new: ['New', 'g'], fix: ['Fix', 'y'], change: ['Change', 'b'] };
  function LogView() {
    let h = back() + `<h1 class="title">What's new</h1><div class="sub">Every update, newest first</div>`;
    if (!LOG) { loadLog(true); return h + card('', '<p class="muted">Loading the list. You need internet the first time.</p>'); }
    const seen = S.logSeen || 0;
    h += LOG.slice().sort((a, b) => (b.v || 0) - (a.v || 0)).map((x) => card(C.longDate(x.date), `<p class="med">${esc(x.title || '')}${(x.v || 0) > seen ? '<span class="pill b">New</span>' : ''}</p>` +
      (x.items || []).map((i) => { const t = LOG_TYPES[i.type] || LOG_TYPES.change; return `<div class="logrow"><span class="pill ${t[1]}">${t[0]}</span><span>${esc(i.text || '')}</span></div>`; }).join(''))).join('');
    if (logTop() > seen) { S.logSeen = logTop(); save(); }
    return h;
  }
  function More() {
    const v = ui.more;
    if (v === 'bills') return BillsView();
    if (v === 'household') return HouseholdView();
    if (v === 'cards') return CardsView();
    if (v === 'import') return ImportView();
    if (v === 'afford') return AffordView();
    if (v === 'recap') return RecapView();
    if (v === 'budgetEdit') return BudgetEditView();
    if (v === 'rules') return RulesView();
    if (v === 'security') return SecurityView();
    if (v === 'bank') return BankView();
    if (v === 'log') return LogView();
    const rows = [['log', "What's new"], ['bills', 'Recurring bills'], ['household', mahi() ? "Dad's household bills" : 'Household bills'], ['cards', 'Cards and balances'], ['import', 'Import transactions'], ['afford', 'Can I afford this?'], ['recap', 'Weekly and monthly reports'], ['budgetEdit', 'Budget and income'], ['rules', 'Category rules'], ['security', 'Settings: theme, text size, PIN, backup'], ['bank', 'Automatic bank connection']];
    return `<div class="head"><h1 class="title">More</h1></div><div class="sub">Tools and settings</div>` + card('', `<div class="menu">${rows.map((r) => `<button class="mrow" data-act="openMore" data-v="${r[0]}"><span>${r[1]}${r[0] === 'log' && logUnread() ? '<span class="pill b">New</span>' : ''}</span><span class="chev">&rsaquo;</span></button>`).join('')}</div>`) + card('', '<button class="btn" data-act="paycheck">I got paid: plan this paycheck</button><button class="mt btn" data-act="quickSetup">Run setup again</button>');
  }

  function BillsView() {
    const mk = ui.bmk || C.monthKey(C.today()), t = C.today();
    let h = back() + `<h1 class="title">Recurring bills</h1><div class="sub">Check a bill to count it as spent</div>` + monthNav(mk, 'bnav');
    h += card('Bills', S.bills.map((b) => {
      const paid = billPaid(b, mk), due = b.day ? dueDate(mk, b.day) : null, late = !paid && due && due < t;
      return `<div class="item row"><label class="f1 check"><input type="checkbox" data-act="billPaid" data-id="${b.id}" ${paid ? 'checked' : ''}><span><span class="t ${late ? 'r' : ''}">${esc(b.name)}</span><br><span class="muted small">${fm(b.amount)}, ${due ? 'due ' + C.shortDate(due) : 'no due day set'}</span></span></label><button class="btn small" data-act="editBill" data-id="${b.id}">Edit</button></div>`;
    }).join('') || '<p class="muted">No bills yet.</p>');
    h += `<button class="mb16 btn primary" data-act="addBill">Add a bill</button>`;
    const mon = sum(S.bills, (b) => b.amount), subs = S.bills.filter((b) => b.cat === 'subs');
    if (S.bills.length) h += card('Yearly cost', `<p class="big">${fm(mon * 12)} <span class="muted med">a year</span></p><p class="muted">${fm(mon)} a month across ${S.bills.length} bill${S.bills.length === 1 ? '' : 's'}.${subs.length ? ' Subscriptions alone cost ' + fm(sum(subs, (b) => b.amount) * 12) + ' a year.' : ''}</p>`);
    if (subs.length) h += card('Subscription check', subs.map((b) => {
      const due = !b.reviewed || C.daysBetween(b.reviewed, t) >= SUB_DAYS, lp = lastPaid(b);
      return `<div class="item"><div class="row"><span class="t">${esc(b.name)}</span><b>${fm(b.amount * 12)}<span class="muted small"> a year</span></b></div><div class="muted small">${lp ? 'Last marked paid ' + C.shortDate(lp) : 'Never marked paid'}${b.reviewed ? '. Checked ' + C.shortDate(b.reviewed) : ''}</div>${due ? `<p class="mt8 med">Still using it?</p><div class="btns"><button class="btn small" data-act="subKeep" data-id="${b.id}">Keep it</button><button class="btn small danger" data-act="subCancel" data-id="${b.id}">I cancelled it</button></div>` : ''}</div>`;
    }).join('') + '<p class="muted small mt8">Each one asks again every 3 months, so nothing renews without you noticing.</p>');
    const nd = S.bills.filter((b) => !b.day).length;
    h += card('Reminders on your calendar', `<p class="muted">Adds each bill with a due day to your phone calendar as a monthly event, with an alert at 9 AM the day before. It also adds a weekly Sunday check in${S.goals.ins.due ? ' and your insurance due date' : ''}.</p>${nd ? `<p class="small y">${nd} bill${nd === 1 ? ' has' : 's have'} no due day and will be left out. Tap Edit to add one.</p>` : ''}<div class="btns"><button class="btn primary" data-act="icsOpen">Add to Calendar</button><button class="btn" data-act="icsShare">Share file</button></div><p class="muted small mt8">If you change a due day later, add them again and delete the old events.</p>`);
    return h;
  }

  function HouseholdView() {
    const items = S.household.items, total = sum(items, (i) => i.amount), t = C.monthKey(C.today());
    let h = back() + `<h1 class="title">${mahi() ? "Dad's bills" : 'Household bills'}</h1><div class="sub">Pass through only. Tag any charge as Household when you add it.</div>`;
    h += card('Monthly bills', items.map((it, i) => `<div class="item"><div class="g8 two row"><input type="text" data-path="household.items.${i}.name" data-t="s" value="${esc(it.name)}"><input class="w120" type="text" inputmode="decimal" data-path="household.items.${i}.amount" data-t="n" data-re="1" value="${it.amount}"></div><button class="mt8 btn small danger" data-act="delHh" data-i="${i}">Remove</button></div>`).join('') + `<div class="mt12 row"><b>Total</b><b>${fm(total)}</b></div><button class="mt btn" data-act="addHh">Add a bill</button>`);
    const months = [0, 1, 2, 3, 4, 5].map((n) => C.shiftMonthKey(t, -n));
    h += card(mahi() ? "Dad's deposit by month" : 'Deposit received by month', months.map((mk) => {
      const dep = S.household.deposits[mk];
      let st = '<span class="pill">No deposit logged</span>';
      if (dep > 0) st = dep + 0.004 >= total ? '<span class="pill g">Covered</span>' : `<span class="pill r">Short ${fm(total - dep)}</span>`;
      return `<div class="item"><div class="row"><span class="t">${C.monthName(mk)}</span>${st}</div><input class="mt8" type="text" inputmode="decimal" placeholder="Deposit amount" data-path="household.deposits.${mk}" data-t="n" data-re="1" value="${dep || ''}"></div>`;
    }).join(''));
    return h;
  }

  function CardsView() {
    let h = back() + `<h1 class="title">Cards and balances</h1><div class="sub">Nickname and last 4 digits only</div>`;
    const owed = cardsOwed(), chk = payPool();
    if (owed > chk && owed > 0) h += card('Warning', `<p class="med r">Cards owe ${fm(owed)}</p><p>${payName()} has ${fm(chk)}. You are short ${fm(owed - chk)} before you pay them off.</p>`, 'warn');
    else if (owed > 0) h += card('Payoff check', `<p class="med g">${payName()} covers your cards</p><p class="muted">${fm(chk - owed)} to spare after ${fm(owed)} in card balances.</p>`);
    h += card('Pay cards off from', `<select data-path="paySource" data-re="1"><option value="checking" ${payType() === 'checking' ? 'selected' : ''}>Checking</option><option value="savings" ${payType() === 'savings' ? 'selected' : ''}>Savings</option></select>`);
    h += card('Automatic balances', `<label class="check"><input type="checkbox" data-act="toggleAutoBal" ${S.autoBal ? 'checked' : ''}>Update balances when I log purchases</label><p class="muted small">A purchase on a card adds to what it owes. A purchase on checking or savings takes it out.${S.autoBal && S.balSince ? ' Counting purchases dated ' + C.shortDate(S.balSince) + ' or later.' : ''} Compare with your bank now and then and fix any balance below.</p>`);
    h += card('Balances', S.accounts.map((a, i) => `<div class="item"><div class="row"><span class="t">${esc(a.name)}${a.last4 ? ' ending ' + esc(a.last4) : ''}<span class="pill">${a.type === 'card' ? 'Card' : a.type === 'savings' ? 'Savings' : 'Checking'}</span></span><button class="btn small" data-act="editAcct" data-id="${a.id}">Edit</button></div><input class="mt8" type="text" inputmode="decimal" placeholder="Balance" data-path="accounts.${i}.balance" data-t="n" data-re="1" value="${a.balance || ''}">${a.type === 'card' && a.balance > 0 ? `<button class="mt8 btn small" data-act="payCard" data-id="${a.id}">I paid this card</button>` : ''}</div>`).join(''));
    const tr = (S.transfers || []).slice(-3).reverse();
    if (tr.length) h += card('Recent card payments', tr.map((x) => { const to = S.accounts.find((a) => a.id === x.to), fr = S.accounts.find((a) => a.id === x.from); return `<div class="row item"><span>${C.shortDate(x.date)}, ${esc(to ? to.name : 'Card')} from ${esc(fr ? fr.name : 'account')}</span><b>${fm(x.amount)}</b></div>`; }).join(''));
    h += `<button class="btn primary" data-act="addAcct">Add a card or account</button>`;
    return h;
  }

  function RulesView() {
    let h = back() + `<h1 class="title">Category rules</h1><div class="sub">Used by imports. First match wins.</div>`;
    h += card('Rules', S.rules.map((r, i) => `<div class="item row"><span><b>${esc(r.match)}</b> goes to ${esc(catName(r.cat))}</span><button class="btn small danger" data-act="delRule" data-i="${i}">Delete</button></div>`).join('') || '<p class="muted">No rules yet.</p>');
    h += card('Add a rule', `<form data-form="rule"><label class="f">Merchant contains</label><input type="text" name="match" autocomplete="off" required><label class="f">Category</label><select name="cat">${catOpts('')}</select><div class="btns"><button class="btn primary" type="submit">Add rule</button></div></form>`);
    return h;
  }

  function BudgetEditView() {
    const m = S.mode, b = budgetOf();
    let h = back() + `<h1 class="title">Budget and income</h1><div class="sub">Editing ${m === 'school' ? 'School year' : 'Summer'} mode</div>`;
    h += `<div class="seg"><button class="${m === 'school' ? 'on' : ''}" data-act="mode" data-m="school">School year</button><button class="${m === 'summer' ? 'on' : ''}" data-act="mode" data-m="summer">Summer</button></div>`;
    if (m === 'school') h += card('Income', `<label class="f">Monthly paycheck income</label><input type="text" inputmode="decimal" data-path="budget.school.income" data-t="n" data-re="1" value="${b.income}"><label class="f">How often you get paid</label><select data-path="payFreq" data-t="s" data-re="1">${FREQS.map((o) => `<option value="${o[0]}" ${S.payFreq === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><p class="muted small">Bonus money like tips is logged separately and never counted as income.</p>`);
    else h += card(mahi() ? 'Toyota co op pay' : 'Summer job pay', `<label class="f">Pay per check</label><input type="text" inputmode="decimal" data-path="budget.summer.pay" data-t="n" data-re="1" value="${b.pay || ''}"><label class="f">How often</label><select data-path="budget.summer.freq" data-t="s" data-re="1">${[['weekly', 'Weekly'], ['biweekly', 'Every two weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly']].map((o) => `<option value="${o[0]}" ${b.freq === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><p class="muted">About ${fm(incomeOf('summer'))} a month.</p>`);
    h += card('Weekly spending money', `<input type="text" inputmode="decimal" data-path="budget.${m}.foodWeek" data-t="n" data-re="1" value="${b.foodWeek}"><p class="muted small">One limit for food, Amazon, and anything else that is not a bill. About ${fm(poolMonth(m))} a month.</p>`);
    h += card('Spending types', '<p class="muted small">The kinds of things your weekly money goes to. Rename them or add your own.</p>' + S.cats.map((c, i) => c.kind !== 'flex' ? '' : `<div class="g8 row mt8"><input type="text" data-path="cats.${i}.name" data-t="s" value="${esc(c.name)}">${c.id === 'other' ? '' : `<button class="btn small danger" data-act="delType" data-id="${c.id}">Remove</button>`}</div>`).join('') + '<button class="mt btn" data-act="addType">Add a type</button>');
    h += card('Monthly bills and fixed costs', S.cats.filter((c) => c.kind === 'fixed').map((c) => `<label class="f">${esc(c.name)}</label><input type="text" inputmode="decimal" data-path="budget.${m}.amounts.${c.id}" data-t="n" data-re="1" value="${b.amounts[c.id] || 0}">`).join(''));
    h += card('Rollover', `<label class="check"><input type="checkbox" data-act="toggleRoll" ${S.rollover ? 'checked' : ''}>Roll unspent spending money into next week</label><p class="muted small">Up to one extra week's worth can carry over.</p><label class="check mt8"><input type="checkbox" data-act="toggleOver" ${S.overCarry ? 'checked' : ''}>Take overspending out of next week</label><p class="muted small">${S.overCarry ? 'If you go over, next week starts with that much less. A big overspend keeps carrying until it is paid back.' : 'Going over does not carry, so a bad week never eats into the next one.'}</p>`);
    const lo = LO();
    h += card('Savings tracker', `<p class="muted small">Whatever is left at the end of each month counts as saved.</p><label class="f">Start counting from</label><input type="month" data-path="leftover.start" data-t="s" data-re="1" value="${lo.start}"><label class="f">Already saved this year before that</label><input type="text" inputmode="decimal" data-path="leftover.before" data-t="n" data-re="1" value="${lo.before || ''}" placeholder="0">`);
    const labels = { mom: mahi() ? 'Paying back Mom' : 'Payback goal', gen: 'General savings', trip: 'Trip fund' };
    h += card('Monthly savings targets', Object.keys(b.savings).map((k) => `<label class="f">${labels[k] || k}</label><input type="text" inputmode="decimal" data-path="budget.${m}.savings.${k}" data-t="n" data-re="1" value="${b.savings[k]}">`).join(''));
    const inc = incomeOf(m), sp = plannedSpend(), sv = plannedSavings(), left = C.round2(inc - sp - sv);
    h += card('Plan check', `<div class="row"><span>Income</span><b>${fm(inc)}</b></div><div class="row"><span>Spending</span><b>${fm(sp)}</b></div><div class="row"><span>Savings</span><b>${fm(sv)}</b></div><div class="row"><span>${left < 0 ? 'Over plan by' : 'Left over to savings'}</span><b class="${left < 0 ? 'r' : left === 0 ? 'g' : ''}">${fm(left)}</b></div>`);
    return h;
  }

  function AffordView() {
    return back() + `<h1 class="title">Can I afford this?</h1><div class="sub">See the impact before you buy</div>` + card('', `<form data-form="afford" data-live="afford"><label class="f">Price</label><input class="amount" type="text" inputmode="decimal" name="price" placeholder="0.00" autocomplete="off"><label class="f">Category</label><select name="cat">${S.cats.map((c) => `<option value="${c.id}" ${c.id === 'food' ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></form>`) + `<div id="affout"></div>`;
  }
  function affordHTML(price, cat) {
    if (!(price > 0)) return '';
    const t = C.today(), mk = C.monthKey(t), b = budgetOf(), ms = monthSpend(mk), ws = C.weekStart(t);
    const line = (label, left, after) => `<div class="item"><div class="t">${label}</div><div class="row"><span class="muted">Now</span><span>${fm(left)} ${left < 0 ? 'over' : 'left'}</span></div><div class="row"><span class="muted">After</span><b class="${after < 0 ? 'r' : after < price ? 'y' : 'g'}">${fm(after)} ${after < 0 ? 'over' : 'left'}</b></div></div>`;
    let out = '';
    if (isFlex(cat)) {
      const l = weekLimit(ws) - weekSpend(ws); out += line('This week, spending money', l, l - price);
      const flexM = sum(S.cats.filter((c) => c.kind === 'flex'), (c) => ms[c.id] || 0), pl = poolMonth() - flexM;
      out += line('This month, spending money', pl, pl - price);
      const tl0 = plannedSpend() - sum(Object.values(ms));
      out += line('This month, whole budget', tl0, tl0 - price);
      const bad = l - price < 0 || pl - price < 0;
      return card('Impact', (bad ? '<p class="med r">That puts you over your spending money.</p>' : (l - price < price ? '<p class="med y">It fits, but this week gets tight.</p>' : '<p class="med g">It fits comfortably.</p>')) + out);
    }
    const cl = (b.amounts[cat] || 0) - (ms[cat] || 0);
    out += line('This month, ' + esc(catName(cat)), cl, cl - price);
    const tl = plannedSpend() - sum(Object.values(ms));
    out += line('This month, whole budget', tl, tl - price);
    const verdict = (cl - price < 0 || tl - price < 0) ? '<p class="med r">That puts you over budget.</p>' : (cl - price < price ? '<p class="med y">It fits, but it gets tight.</p>' : '<p class="med g">It fits comfortably.</p>');
    return card('Impact', verdict + out);
  }

  function RecapView() {
    const r = report(), isW = r.per === 'week', unit = isW ? 'week' : 'month';
    let h = back() + `<h1 class="title">Reports</h1><div class="sub">Everything you logged, by ${unit}</div>`;
    h += `<div class="seg"><button class="${isW ? 'on' : ''}" data-act="rper" data-v="week">Weekly</button><button class="${isW ? '' : 'on'}" data-act="rper" data-v="month">Monthly</button></div>`;
    h += `<div class="mb14 row"><button class="btn small" data-act="rnav" data-d="-1">Previous</button><div class="m0 med tc f1 navt">${esc(r.title)}</div><button class="btn small" data-act="rnav" data-d="1" ${r.future ? 'disabled' : ''}>Next</button></div>`;
    const trend = card(isW ? 'Last 8 weeks' : 'Last 6 months', trendHTML(r));
    if (!r.all.length) return h + card('', `<p class="muted">Nothing was logged this ${unit}.</p>`) + trend;

    const diff = r.tot - r.prevTot, pct = r.prevTot ? Math.round(Math.abs(diff) / r.prevTot * 100) : 0;
    const cmp = !r.prevTot ? `Nothing was logged the ${unit} before.` : Math.abs(diff) < 0.005 ? `Same as last ${unit}.` : `${fm(diff)} ${diff > 0 ? 'more' : 'less'} than last ${unit} (${pct}%).`;
    h += card('Total spent', `<p class="big">${fm(r.tot)}${r.plan ? ` <span class="muted med">of ${fm(r.plan)}</span>` : ''}</p>${r.plan ? bar(r.tot / r.plan, C.status(r.tot / r.plan)) : ''}<p class="${diff > 0 && r.prevTot ? 'r' : diff < 0 ? 'g' : 'muted'}">${cmp}</p>` +
      `<div class="row item"><span>Purchases</span><b>${r.list.length}</b></div><div class="row item"><span>Average per day</span><b>${fm(r.tot / r.days)}</b></div>` +
      (r.big ? `<div class="row item"><span>Biggest: ${esc(r.big.note || catName(r.big.cat))}</span><b>${fm(r.big.amount)}</b></div>` : ''));

    h += trend;
    if (isW) {
      const fw = weekLimit(r.from), fs = C.round2(sum(Object.keys(r.byCat).filter(isFlex), (k) => r.byCat[k]));
      if (fw || budgetOf().foodWeek) h += card('Spending money', `<p class="big ${fs > fw ? 'r' : 'g'}">${fm(fs)} <span class="muted med">of ${fm(fw)}</span></p>${bar(fw > 0 ? fs / fw : 1, C.status(fw > 0 ? fs / fw : 1))}<p class="muted">${fs > fw ? fm(fs - fw) + ' over the weekly limit.' : fm(fw - fs) + ' under the weekly limit.'}</p>`);
    }

    const cats = Object.keys(r.byCat).sort((a, c) => r.byCat[c] - r.byCat[a]);
    h += card('By category', cats.map((k) => {
      const v = r.byCat[k], lim = isW ? 0 : budgetOf().amounts[k] || 0;
      const pc = lim ? v / lim : r.tot ? v / r.tot : 0;
      return `<div class="rline"><div class="row"><span>${esc(catName(k))}</span><b>${fm(v)}${lim ? ` <span class="muted small">of ${fm(lim)}</span>` : ''}</b></div>${bar(pc, lim ? C.status(pc) : 'b')}</div>`;
    }).join('') || '<p class="muted">No counted spending.</p>');

    const mx = Math.max(...r.buckets.map((b) => b.v), 0.01);
    h += card(isW ? 'Day by day' : 'Week by week', r.buckets.map((b) => `<div class="rline"><div class="row"><span>${esc(b.n)}</span><b>${fm(b.v)}</b></div>${bar(b.v / mx, 'b')}</div>`).join(''));

    if (r.top.length) h += card('Where it went', r.top.map((g) => `<div class="row item"><span>${esc(g.n)} <span class="muted small">${g.c}x</span></span><b>${fm(g.v)}</b></div>`).join(''));
    const accts = Object.keys(r.byAcct);
    if (accts.length > 1 || (accts.length && S.accounts.length > 1)) h += card('By account', accts.map((k) => `<div class="row item"><span>${esc(k)}</span><b>${fm(r.byAcct[k])}</b></div>`).join(''));

    const ex = [['Paid from savings', r.fromSav], ['Covered for others (IOUs)', r.others], ['Household bills', r.hh]].filter((x) => x[1] > 0);
    if (ex.length) h += card('Not counted in your budget', ex.map((x) => `<div class="row item"><span>${x[0]}</span><b>${fm(x[1])}</b></div>`).join(''));

    const sv = [['Paychecks', r.paid], ['Saved toward goals', r.saved], ['IOU payments back to you', r.iouIn]].filter((x) => x[1] > 0);
    if (sv.length || !isW) h += card('Money in', (sv.map((x) => `<div class="row item"><span>${x[0]}</span><b class="g">${fm(x[1])}</b></div>`).join('') || '<p class="muted">No savings or IOU payments logged.</p>') + (!isW && plannedSavings() ? `<p class="muted small mt8">Savings plan this month: ${fm(plannedSavings())}. ${r.saved >= plannedSavings() ? 'You hit it.' : fm(plannedSavings() - r.saved) + ' short.'}</p>` : ''));

    h += card('Everything logged', `<details class="rlist"><summary>Show all ${r.all.length} entries</summary>${r.all.slice().sort((a, c) => (c.date + c.id).localeCompare(a.date + a.id)).map((e) => `<div class="row item"><span>${C.shortDate(e.date)} · ${esc(e.note || catName(e.cat))}${counted(e) ? '' : ' <span class="muted small">not counted</span>'}</span><b>${fm(e.amount)}</b></div>`).join('')}</details>`);
    h += `<div class="btns"><button class="btn" data-act="shareReport">Share summary</button><button class="btn" data-act="csvReport">Save as CSV</button></div>`;
    return h;
  }

  // Builds the numbers for the weekly or monthly report.
  function report() {
    const per = ui.rper || 'week', t = C.today();
    let from, to, pFrom, pTo, title, buckets = [];
    if (per === 'week') {
      from = ui.rws || C.weekStart(t); to = C.addDays(from, 6);
      pFrom = C.addDays(from, -7); pTo = C.addDays(from, -1);
      title = C.shortDate(from) + ' to ' + C.shortDate(to);
      for (let i = 0; i < 7; i++) { const d = C.addDays(from, i); buckets.push({ n: C.parse(d).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }), a: d, b: d, v: 0 }); }
    } else {
      const mk = ui.rmk || C.monthKey(t);
      from = mk + '-01'; to = mk + '-' + pad(dim(mk));
      const pk = C.shiftMonthKey(mk, -1); pFrom = pk + '-01'; pTo = pk + '-' + pad(dim(pk));
      title = C.monthName(mk);
      for (let d = from; d <= to; d = C.addDays(d, 7)) { const e = C.addDays(d, 6) > to ? to : C.addDays(d, 6); buckets.push({ n: C.shortDate(d) + ' to ' + C.shortDate(e), a: d, b: e, v: 0 }); }
    }
    const inR = (d) => d >= from && d <= to;
    const all = S.expenses.filter((e) => inR(e.date));
    const list = all.filter(counted);
    const tot = C.round2(sum(list, (e) => e.amount));
    const prevTot = C.round2(sum(S.expenses.filter((e) => counted(e) && e.date >= pFrom && e.date <= pTo), (e) => e.amount));
    const byCat = {}, byAcct = {}, groups = {};
    list.forEach((e) => {
      byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
      const a = S.accounts.find((x) => x.id === e.account), an = a ? a.name + (a.last4 ? ' ' + a.last4 : '') : 'No account';
      byAcct[an] = (byAcct[an] || 0) + e.amount;
      const k = (e.note || catName(e.cat)).trim().toLowerCase();
      groups[k] = groups[k] || { n: e.note || catName(e.cat), v: 0, c: 0 }; groups[k].v += e.amount; groups[k].c++;
      const bk = buckets.find((b) => e.date >= b.a && e.date <= b.b); if (bk) bk.v += e.amount;
    });
    const end = to < t ? to : t;
    const days = Math.max(1, C.daysBetween(from, end) + 1);
    const saved = sum(Object.values(S.goals), (g) => sum(g.contribs.filter((c) => inR(c.date)), (c) => c.amount));
    const iouIn = sum(S.ious.filter((i) => i.dir === 'owedToMe'), (i) => sum((i.payments || []).filter((p) => p.date && inR(p.date)), (p) => p.amount));
    const s = (f) => C.round2(sum(all.filter(f), (e) => e.amount));
    const paid = sum((S.paychecks || []).filter((x) => inR(x.date)), (x) => x.amount);
    return {
      per, from, to, title, all, list, tot, prevTot, byCat, byAcct, buckets, days, saved, iouIn, paid,
      future: to >= t,
      plan: per === 'week' ? 0 : plannedSpend(),
      big: list.slice().sort((a, c) => c.amount - a.amount)[0],
      top: Object.values(groups).sort((a, c) => c.v - a.v).slice(0, 5),
      fromSav: s((e) => e.paidFromSavings && !e.household), others: s((e) => e.forOther && !e.household && !e.paidFromSavings), hh: s((e) => e.household)
    };
  }
  function trendHTML(r) {
    const isW = r.per === 'week', cat = ui.rtc || '', pts = [];
    for (let i = isW ? 7 : 5; i >= 0; i--) {
      let a, b, n;
      if (isW) { a = C.addDays(r.from, -7 * i); b = C.addDays(a, 6); n = C.parse(a).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }); }
      else { const mk = C.shiftMonthKey(C.monthKey(r.from), -i); a = mk + '-01'; b = mk + '-' + pad(dim(mk)); n = C.parse(a).toLocaleDateString('en-US', { month: 'short' }); }
      pts.push({ n, v: sum(S.expenses.filter((e) => counted(e) && (!cat || e.cat === cat) && e.date >= a && e.date <= b), (e) => e.amount) });
    }
    const bo = budgetOf();
    const plan = cat ? (isFlex(cat) ? 0 : isW ? 0 : bo.amounts[cat] || 0) : (isW ? 0 : plannedSpend());
    const W = 320, H = 160, top = 18, bot = 22, mx = Math.max(plan, ...pts.map((p) => p.v), 1), bw = W / pts.length;
    const y = (v) => top + (H - top - bot) * (1 - v / mx);
    let svg = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending trend">`;
    pts.forEach((p, i) => {
      const cx = i * bw + bw / 2, yy = y(p.v);
      svg += `<rect class="tb${i === pts.length - 1 ? ' cur' : ''}" x="${(i * bw + bw * 0.17).toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw * 0.66).toFixed(1)}" height="${Math.max(0, H - bot - yy).toFixed(1)}" rx="4"/><text class="tl" x="${cx.toFixed(1)}" y="${H - 6}">${esc(p.n)}</text>`;
      if (p.v) svg += `<text class="tv" x="${cx.toFixed(1)}" y="${(yy - 5).toFixed(1)}">${Math.round(p.v)}</text>`;
    });
    if (plan) svg += `<line class="tp" x1="0" x2="${W}" y1="${y(plan).toFixed(1)}" y2="${y(plan).toFixed(1)}"/>`;
    svg += '</svg>';
    const prev = pts.slice(0, -1), avg = sum(prev, (p) => p.v) / prev.length, cur = pts[pts.length - 1].v;
    return `<select id="rtc"><option value="">All spending</option>${S.cats.map((c) => `<option value="${c.id}" ${c.id === cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${svg}<p class="muted small">${plan ? 'The dashed line is your budget. ' : ''}Average of the ${prev.length} before this one: ${fm(avg)}.${avg && cur > avg * 1.15 ? ' This one is running higher.' : ''}</p>`;
  }
  function icsText() {
    const t = C.today(), stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const d8 = (x) => x.replace(/-/g, ''), q = (x) => String(x).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Money app//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Money'];
    const alarm = (trig, msg) => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + q(msg), 'TRIGGER:' + trig, 'END:VALARM'];
    S.bills.filter((b) => b.day).forEach((b) => {
      const mk = C.monthKey(t); let first = dueDate(mk, b.day); if (first < t) first = dueDate(C.shiftMonthKey(mk, 1), b.day);
      const days = []; for (let d = 28; d <= b.day; d++) days.push(d);
      const rr = b.day > 28 ? 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + days.join(',') + ';BYSETPOS=-1' : 'RRULE:FREQ=MONTHLY;BYMONTHDAY=' + b.day;
      L.push('BEGIN:VEVENT', 'UID:bill-' + b.id + '@money.app', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d8(first), 'DTEND;VALUE=DATE:' + d8(C.addDays(first, 1)), rr,
        'SUMMARY:' + q(b.name + ' due: ' + fm(b.amount)), 'DESCRIPTION:' + q('Mark it paid in the Money app under Recurring bills.'), ...alarm('-PT15H', b.name + ' is due tomorrow: ' + fm(b.amount)), 'END:VEVENT');
    });
    const sun = C.addDays(C.weekStart(t), 7);
    L.push('BEGIN:VEVENT', 'UID:weekly-checkin@money.app', 'DTSTAMP:' + stamp, 'DTSTART:' + d8(sun) + 'T180000', 'DURATION:PT15M', 'RRULE:FREQ=WEEKLY;BYDAY=SU',
      'SUMMARY:Money: weekly check in', 'DESCRIPTION:' + q('Log anything you missed, read the weekly report, settle IOUs, and back up.'), ...alarm('PT0M', 'Weekly money check in'), 'END:VEVENT');
    const ins = S.goals.ins;
    if (ins.due && ins.due >= t) L.push('BEGIN:VEVENT', 'UID:ins-' + ins.due + '@money.app', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + d8(ins.due), 'DTEND;VALUE=DATE:' + d8(C.addDays(ins.due, 1)),
      'SUMMARY:' + q(ins.name + ' bill due'), ...alarm('-P6DT15H', ins.name + ' is due in a week'), 'END:VEVENT');
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }
  function payPlan(amount, date) {
    const f = PER_MONTH[payFreq()] || 1, share = 1 / f, b = budgetOf();
    const fixed = C.round2(sum(S.cats.filter((c) => c.kind === 'fixed'), (c) => b.amounts[c.id] || 0) * share);
    const flex = 0;
    const weeks = Math.round((52 / 12 / f) * 10) / 10, food = C.round2((b.foodWeek || 0) * weeks);
    const goals = Object.keys(b.savings).map((k) => ({ k, v: C.round2((b.savings[k] || 0) * share) })).filter((g) => g.v > 0);
    const saving = sum(goals, (g) => g.v), left = C.round2(amount - fixed - flex - food - saving);
    const next = C.addDays(date, DAYS_PER[payFreq()] || 14), dueSoon = [];
    S.bills.filter((b2) => b2.day).forEach((b2) => {
      [C.monthKey(date), C.shiftMonthKey(C.monthKey(date), 1)].forEach((mk) => {
        const d = dueDate(mk, b2.day);
        if (d >= date && d < next && !billPaid(b2, mk)) dueSoon.push({ b: b2, d });
      });
    });
    return { fixed, flex, weeks, food, goals, saving, left, next, dueSoon };
  }
  function payPlanHTML(amount, date) {
    if (!(amount > 0)) return '<p class="muted small">Enter the amount to see the plan.</p>';
    const p = payPlan(amount, date), row = (n, v, cls) => `<div class="row item"><span>${n}</span><b class="${cls || ''}">${fm(v)}</b></div>`;
    let h = '<div class="card inset">' + row('Bills and fixed costs', p.fixed) + (p.flex ? row('Shopping and other', p.flex) : '') + row(`Spending money, ${p.weeks} week${p.weeks === 1 ? '' : 's'}`, p.food) +
      p.goals.map((g) => row('Save: ' + esc(S.goals[g.k] ? S.goals[g.k].name : g.k), g.v, 'g')).join('') +
      row(p.left < 0 ? 'Short by' : 'Left over for savings', p.left, p.left < 0 ? 'r' : 'g') + '</div>';
    if (p.left < 0) h += `<p class="small r">This check is ${fm(-p.left)} short of your plan. You can skip some savings this once, or fix the budget so future checks cover it.</p><button type="button" class="mt8 btn" data-act="fixBudget">Fix the budget for future checks</button>`;
    h += p.dueSoon.length ? `<p class="label mt">Due before your next check (${C.shortDate(p.next)})</p>` + p.dueSoon.sort((a, c) => (a.d < c.d ? -1 : 1)).map((x) => row(esc(x.b.name) + ', ' + C.shortDate(x.d), x.b.amount)).join('') : '<p class="muted small mt8">No bills with due days fall before your next check.</p>';
    return h;
  }
  // Ways to close a paycheck shortfall for good. Each returns the changes it would make to the monthly plan.
  function fixOptions(short) {
    const f = PER_MONTH[payFreq()] || 1, b = budgetOf(), wpm = 52 / 12;
    const up = (x) => Math.ceil(x * 100 - 1e-6) / 100;
    const cut = up(short * f);                       // monthly amount to free up
    const food = (b.foodWeek || 0) * wpm;
    const flexCats = [];
    const flex = sum(flexCats, (c) => b.amounts[c.id]);
    const savKeys = Object.keys(b.savings).filter((k) => (b.savings[k] || 0) > 0);
    const sav = sum(savKeys, (k) => b.savings[k]);
    const opts = [];
    const plan = (foodCut, flexCut, savCut) => {
      const ch = [];
      if (foodCut > 0) { const nw = Math.max(0, C.round2(b.foodWeek - up(foodCut / wpm))); ch.push({ kind: 'food', label: 'Weekly spending money', from: b.foodWeek, to: nw, unit: 'a week' }); }
      if (flexCut > 0) flexCats.forEach((c) => { const v = b.amounts[c.id]; ch.push({ kind: 'cat', id: c.id, label: catName(c.id), from: v, to: Math.max(0, C.round2(v - up(flexCut * v / flex))), unit: 'a month' }); });
      if (savCut > 0) savKeys.forEach((k) => { const v = b.savings[k]; ch.push({ kind: 'sav', id: k, label: 'Save to ' + (S.goals[k] ? S.goals[k].name : k), from: v, to: Math.max(0, C.round2(v - up(savCut * v / sav))), unit: 'a month' }); });
      return ch;
    };
    if (food >= cut) opts.push({ t: 'Lower your weekly spending money', ch: plan(cut, 0, 0) });
    if (flex >= cut) opts.push({ t: 'Trim shopping and other', ch: plan(0, cut, 0) });
    if (sav >= cut) opts.push({ t: 'Save a little less', ch: plan(0, 0, cut) });
    const tot = food + flex + sav;
    const kinds = [food, flex, sav].filter((x) => x > 0).length;
    if (tot >= cut && kinds > 1) opts.push({ t: kinds === 3 ? 'Spread it across all three' : 'Split it between both', ch: plan(cut * food / tot, cut * flex / tot, cut * sav / tot) });
    return { cut, opts };
  }
  async function shrinkImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    } finally { URL.revokeObjectURL(url); }
  }
  function rcptBoxHTML() {
    const e = ui.rcptFor ? S.expenses.find((x) => x.id === ui.rcptFor) : null;
    if (ui.rcpt) return `<img class="thumb" src="${ui.rcpt}" alt="Receipt"><button type="button" class="mt8 btn small" data-act="rcptClear">Remove photo</button>`;
    if (e && e.receipt && !ui.rcptDel) return `<div class="btns"><button type="button" class="btn small" data-act="rcptView">View receipt</button><button type="button" class="btn small danger" data-act="rcptClear">Remove</button></div>`;
    return '<button type="button" class="btn small" data-act="rcptPick">Add a photo</button>';
  }
  function reportText(r) {
    const lines = [(r.per === 'week' ? 'Week of ' : '') + r.title, 'Spent: ' + fm(r.tot) + (r.plan ? ' of ' + fm(r.plan) : ''), 'Last ' + r.per + ': ' + fm(r.prevTot), ''];
    Object.keys(r.byCat).sort((a, c) => r.byCat[c] - r.byCat[a]).forEach((k) => lines.push(catName(k) + ': ' + fm(r.byCat[k])));
    if (r.saved) lines.push('', 'Saved: ' + fm(r.saved));
    return lines.join('\n');
  }
  function saveFile(text, name, type) {
    const file = new File([text], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ files: [file], title: name });
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  function SecurityView() {
    return back() + `<h1 class="title">Settings</h1><div class="sub">Your data never leaves this device</div>` +
      card('Theme', `<div class="chips">${THEMES.map((t) => `<label class="${getTheme() === t[0] ? 'on' : ''}"><button type="button" class="tbtn" data-act="setTheme" data-v="${t[0]}"><span class="dot d-${t[0]}"></span>${t[1]}</button></label>`).join('')}</div>`) +
      card('App updates', `<p class="muted small">Pulls the newest version from GitHub. Your data is not touched.</p><button class="btn" data-act="updateApp">Check for updates</button>`) +
      card('Text size', `<input type="range" id="uiscale" class="slider" min="70" max="130" step="5" value="${Math.round(getScale() * 100)}"><div class="row muted small"><span>Smaller</span><span id="uiscaleval">${Math.round(getScale() * 100)}%</span><span>Larger</span></div><button class="btn small mt" data-act="resetScale">Reset to 100%</button>`) +
      card('Lock', V.isAuto() ? `<p class="muted">No lock is on. Anyone holding your unlocked phone can open this app.</p><div class="btns"><button class="btn primary" data-act="setPinNow">Set a PIN</button></div>` : `<p class="muted">Locks after 5 minutes in the background.</p><div class="btns"><button class="btn" data-act="lockNow">Lock now</button><button class="btn" data-act="changePass">Change PIN</button></div><button class="btn mt" data-act="removePin">Remove PIN, no lock</button><div id="facebox"></div>`) +
      card('Backup', `<p class="muted">Saves an encrypted file. Keep it in iCloud Drive in case Safari clears storage.${V.isAuto() ? ' With no PIN on, this file can be opened by anyone who has it, so keep it somewhere private.' : ''} ${S.lastBackup ? 'Last backup ' + C.shortDate(S.lastBackup) + '.' : 'No backup yet.'}</p><div class="btns"><button class="btn" data-act="exportBackup">Export backup</button><button class="btn" data-act="pickBackup">Restore backup</button></div><input type="file" id="bkfile" accept=".json,application/json" hidden>`) +
      card('Privacy', '<p class="muted">Everything is stored encrypted on this device. No server, no analytics. This app never asks for bank logins, full card numbers, or account numbers.</p>') +
      card('Danger zone', '<button class="btn" data-act="blankNow">I\'m not Mahi, clear his budget</button><p class="muted small">Keeps your passcode and logged expenses. Replaces the preloaded budget, bills, goals, and rules with blank ones.</p><button class="mt btn danger" data-act="erase">Erase all data</button>');
  }
  async function fillFaceBox() {
    const box = $('#facebox'); if (!box) return;
    if (V.isAuto()) { box.innerHTML = ''; return; }
    if (!(await V.faceSupported())) { box.innerHTML = ''; return; }
    const on = await V.faceEnabled();
    box.innerHTML = `<button class="mt btn" data-act="${on ? 'faceOff' : 'faceOn'}">${on ? 'Turn off Face ID' : 'Turn on Face ID'}</button>`;
  }

  function BankView() {
    return back() + `<h1 class="title">Bank connection</h1><div class="sub">Not available yet</div>` + card('Why it is not here', '<p>Connecting a bank automatically would need a secure backend server and a service like Plaid to hold access tokens safely. This app has no server on purpose, so your data stays on your phone.</p><p class="muted">When you are ready, a small private backend can be added later. Until then, use manual entry, CSV import, or screenshot import.</p><button class="dim btn" disabled>Connect a bank</button>');
  }

  // ---------- IMPORT ----------
  function ImportView() {
    const im = ui.imp;
    let h = back() + `<h1 class="title">Import</h1><div class="sub">Review everything before it saves</div>`;
    if (!im) {
      h += card('CSV from your bank', `<p class="muted">Download a transaction CSV from your bank, then pick it here. You map the columns once.</p><button class="btn primary" data-act="pickCsv">Choose CSV file</button><input type="file" id="csvfile" accept=".csv,text/csv,text/plain" hidden>`);
      h += card('Screenshot of spending', `<p class="muted">Text is read on this device with Tesseract.js. The image is never uploaded. The reader downloads once, then works offline.</p><button class="btn primary" data-act="pickImg">Choose screenshot</button><input type="file" id="imgfile" accept="image/*" hidden>`);
      return h;
    }
    if (im.busy) return h + card('Working', `<p class="med">${esc(im.busy)}</p><p class="muted">This happens on your device.</p>`);
    if (im.step === 'map') {
      const opts = (sel) => im.header.map((c, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(c || 'Column ' + (i + 1))}</option>`).join('');
      h += card('Map the columns', `<form data-form="csvmap"><label class="f">Date</label><select name="date">${opts(im.guess.date)}</select><label class="f">Description or merchant</label><select name="desc">${opts(im.guess.desc)}</select><label class="f">Amount</label><select name="amount">${opts(im.guess.amount)}</select><label class="f">Spending shows as</label><select name="sign"><option value="neg">Negative numbers</option><option value="pos" ${im.guess.sign === 'pos' ? 'selected' : ''}>Positive numbers</option></select><div class="btns"><button class="btn primary" type="submit">Continue</button></div></form>`);
      return h + `<button class="btn" data-act="impCancel">Cancel</button>`;
    }
    // review
    const n = im.items.filter((x) => x.on).length;
    h += card('Review', `<p class="muted">${im.items.length} found${im.skipped ? ', ' + im.skipped + ' credits skipped' : ''}. Fix amounts and categories, then save.</p><label class="f">Account</label><select id="impacct">${S.accounts.map((a) => `<option value="${a.id}" ${a.id === S.lastAccount ? 'selected' : ''}>${esc(a.name)}${a.last4 ? ' ' + esc(a.last4) : ''}</option>`).join('')}</select>` +
      im.items.map((x, i) => `<div class="rev"><label class="check"><input type="checkbox" data-ri="${i}" data-f="on" ${x.on ? 'checked' : ''}><span class="t">${C.shortDate(x.date)}</span>${x.dup ? '<span class="pill y">Possible duplicate</span>' : ''}</label><input type="text" data-ri="${i}" data-f="desc" value="${esc(x.desc)}"><div class="two"><input type="text" inputmode="decimal" data-ri="${i}" data-f="amount" value="${x.amount.toFixed(2)}"><select data-ri="${i}" data-f="cat">${catOpts(x.cat)}</select></div></div>`).join(''));
    h += `<div class="btns"><button class="btn" data-act="impCancel">Cancel</button><button class="btn primary" data-act="impSave">Save ${n}</button></div>`;
    return h;
  }

  function buildItems(rows) {
    const keys = new Set(S.expenses.map((e) => C.dupKey(e.date, e.amount)));
    return rows.map((r) => {
      const k = C.dupKey(r.date, r.amount), dup = keys.has(k); keys.add(k);
      return Object.assign({}, r, { dup, on: !dup });
    });
  }

  async function handleCsv(file) {
    const rows = C.parseCSV(await file.text());
    if (rows.length < 2) { toast('That file looks empty'); return; }
    const header = rows[0].map((x) => x.trim()), sig = header.join('|');
    const low = header.map((x) => x.toLowerCase());
    const find = (re) => { const i = low.findIndex((x) => re.test(x)); return i < 0 ? 0 : i; };
    const guess = { date: find(/date/), desc: find(/desc|merchant|name|payee|memo/), amount: find(/amount|debit|value/), sign: 'neg' };
    if (S.csvMap && S.csvMap.sig === sig) { ui.imp = { kind: 'csv', rows, header, map: S.csvMap }; csvToReview(); }
    else ui.imp = { kind: 'csv', rows, header, guess, step: 'map', sig };
    render();
  }
  function csvToReview() {
    const im = ui.imp, m = im.map || S.csvMap; let skipped = 0; const out = [];
    im.rows.slice(1).forEach((r) => {
      const amt = C.parseAmount(r[m.amount]); if (isNaN(amt)) return;
      const spending = m.sign === 'neg' ? amt < 0 : amt > 0;
      if (!spending) { skipped++; return; }
      const raw = String(r[m.desc] || ''), desc = C.cleanMerchant(raw) || raw.trim();
      out.push({ date: C.parseDate(r[m.date]), desc, amount: Math.abs(amt), cat: C.categorize(raw, S.rules) });
    });
    im.items = buildItems(out); im.skipped = skipped; im.step = 'review';
  }

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('load'));
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }
  async function handleImg(file) {
    ui.imp = { kind: 'ocr', busy: 'Reading the screenshot' }; render();
    try {
      const T = await loadTesseract();
      const worker = await T.createWorker('eng', 1, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0'
      });
      const res = await worker.recognize(file);
      await worker.terminate();
      const rows = C.parseOcr(res.data.text, S.rules, C.today());
      if (!rows.length) { ui.imp = null; toast('No amounts found. Try a clearer screenshot.'); render(); return; }
      ui.imp = { kind: 'ocr', items: buildItems(rows), skipped: 0, step: 'review' };
    } catch (e) {
      ui.imp = null; toast('The reader could not load. It needs internet the first time.');
    }
    render();
  }

  // ---------- sheets ----------
  function openSheet(html) {
    $('#sheet').innerHTML = `<div class="overlay" data-act="sheetBg"><div class="panel">${html}</div></div>`;
  }
  function closeSheet() { $('#sheet').innerHTML = ''; }

  // ---------- quick setup ----------
  function setupStart() {
    openSheet(`<h2>Quick setup</h2><p class="muted">Who is this app for?</p><div class="col"><button class="btn primary" data-act="setupMahi">I am Mahi</button><button class="btn" data-act="setupNew">Someone new, start blank</button><button class="btn" data-act="setupSkip">Skip for now</button></div><p class="muted small mt">Mahi gets the budget and bills that are already filled in. Someone new gets a clean slate and fills in their own numbers. This takes about a minute.</p>`);
  }
  const acctBal = (type) => { const a = S.accounts.find((x) => x.type === type); return a ? a.balance : 0; };
  const setupForm = () => wizShow('pay');
  const WIZ = ['pay', 'accounts', 'budget', 'bills', 'goals', 'done'];
  const WIZT = { pay: 'Your pay', accounts: 'Accounts and cards', budget: 'Spending plan', bills: 'Recurring bills', goals: 'Savings goals', done: 'Almost done' };
  const mIn = (name, val, ph) => `<input type="text" inputmode="decimal" name="${name}" value="${val ? val : ''}" placeholder="${ph || '0'}" autocomplete="off">`;
  function wizShow(step) {
    ui.wiz = step;
    const i = WIZ.indexOf(step), me = mahi(), b = budgetOf();
    let body = '';
    if (step === 'pay') {
      const f = payFreq();
      body = `<p class="muted">Take home pay is what actually lands in your account after taxes.</p><label class="f">How often you get paid</label><select name="freq">${FREQS.map((o) => `<option value="${o[0]}" ${f === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><label class="f">Take home pay per paycheck</label>${mIn('per', perCheck())}<p class="muted small">If your pay changes, use a typical check. ${S.mode === 'school' ? 'A different summer job can be set later under Budget and income, Summer.' : ''}</p>`;
    } else if (step === 'accounts') {
      const cards = S.accounts.filter((a) => a.type === 'card');
      body = `<p class="muted">Balances right now. Nicknames and last 4 digits only, never full numbers.</p><label class="f">Checking balance</label>${mIn('bal', acctBal('checking'))}<label class="f">Savings balance</label>${mIn('sav', acctBal('savings'))}` +
        `<p class="label mt">Credit cards</p>` + (cards.length ? cards.map((a) => `<div class="card inset"><label class="f">Nickname</label><input type="text" name="cn_${a.id}" value="${esc(a.name)}" autocomplete="off"><div class="two"><div><label class="f">Last 4</label><input type="text" inputmode="numeric" maxlength="4" name="cl_${a.id}" value="${esc(a.last4 || '')}" autocomplete="off"></div><div><label class="f">Owed now</label>${mIn('cb_' + a.id, a.balance)}</div></div><button type="button" class="mt8 btn small danger" data-act="wizRmCard" data-id="${a.id}">Remove card</button></div>`).join('') : '<p class="muted small">No cards yet.</p>') +
        `<button type="button" class="btn" data-act="wizAddCard">Add a credit card</button>` +
        `<label class="f">I pay my cards off from</label><select name="src"><option value="checking" ${payType() === 'checking' ? 'selected' : ''}>Checking</option><option value="savings" ${payType() === 'savings' ? 'selected' : ''}>Savings</option></select>` +
        `<label class="mt check"><input type="checkbox" name="auto" ${S.autoBal ? 'checked' : ''}>Update balances when I log purchases</label><p class="muted small">Recommended. A purchase on a card adds to what it owes, so the app can warn you before ${payType() === 'savings' ? 'savings' : 'checking'} runs short.</p>`;
    } else if (step === 'budget') {
      body = `<p class="muted">${me ? 'Your numbers are filled in. Fix anything that changed.' : 'Leave 0 for anything you do not pay.'}</p><label class="f">Weekly spending money</label>${mIn('fw', b.foodWeek)}<p class="muted small">One limit for food, shopping, and anything else that is not a bill.</p><label class="check"><input type="checkbox" name="roll" ${S.rollover ? 'checked' : ''}>Roll unspent money into next week</label><p class="label mt">Monthly bills and fixed costs</p>` +
        S.cats.filter((c) => c.kind === 'fixed').map((c) => `<label class="f">${esc(c.name)}</label>${mIn('c_' + c.id, b.amounts[c.id])}`).join('');

    } else if (step === 'bills') {
      body = `<p class="muted">Due days let the app warn you, plan each paycheck, and put bills on your calendar.</p>` + S.bills.map((x) => `<div class="card inset"><label class="f">Name</label><input type="text" name="bn_${x.id}" value="${esc(x.name)}" autocomplete="off"><div class="two"><div><label class="f">Amount</label>${mIn('ba_' + x.id, x.amount)}</div><div><label class="f">Due day</label><input type="number" min="1" max="31" name="bd_${x.id}" value="${x.day || ''}" placeholder="1 to 31"></div></div><label class="f">Category</label><select name="bc_${x.id}">${S.cats.map((c) => `<option value="${c.id}" ${x.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><button type="button" class="mt8 btn small danger" data-act="wizRmBill" data-id="${x.id}">Remove bill</button></div>`).join('') +
        `<button type="button" class="btn" data-act="wizAddBill">Add a bill</button><p class="muted small mt8">Put streaming, apps, and memberships under Subscriptions so the app can check on them. If a category budget is lower than its bills, it gets raised to cover them.</p>`;
    } else if (step === 'goals') {
      const g = S.goals;
      body = `<p class="muted">How much goes to each goal per month, plus any targets.</p>` + Object.keys(b.savings).map((k) => `<label class="f">${esc(g[k] ? g[k].name : k)}, per month</label>${mIn('sv_' + k, b.savings[k])}`).join('') +
        `<label class="f">${esc(g.mom.name)}: total you still owe${me ? '' : ' someone, if any'}</label>${mIn('gt_mom', g.mom.target)}` +
        `<label class="f">${esc(g.ins.name)}: amount of the bill</label>${mIn('gt_ins', g.ins.target)}<label class="f">${esc(g.ins.name)}: next due date</label><input type="date" name="gd_ins" value="${g.ins.due || ''}">` +
        `<label class="f">${esc(g.trip.name)}: target</label>${mIn('gt_trip', g.trip.target)}`;
    } else {
      const inc = incomeOf(S.mode), sp = plannedSpend(), sv = plannedSavings(), left = C.round2(inc - sp - sv), gaps = setupGaps();
      body = `<div class="card inset"><div class="row"><span>Monthly income</span><b>${fm(inc)}</b></div><div class="row"><span>Spending plan</span><b>${fm(sp)}</b></div><div class="row"><span>Savings plan</span><b>${fm(sv)}</b></div><div class="row"><span>${left < 0 ? 'Over plan by' : 'Left over to savings'}</span><b class="${left < 0 ? 'r' : 'g'}">${fm(left)}</b></div></div>` +
        (left < 0 ? '<p class="small r">Your plan spends more than you make. Go Back and trim something.</p>' : '') +
        (gaps.length ? '<p class="label mt">Still missing</p>' + gaps.map((x) => `<p class="small y">${x[0]}</p>`).join('') : '') +
        `<p class="label mt">Last few things</p><div class="col"><button type="button" class="btn" data-act="exportBackup">Back up now${S.lastBackup ? ', last ' + C.shortDate(S.lastBackup) : ''}</button><button type="button" class="btn" data-act="icsOpen">Put bill reminders on my calendar</button>${V.isAuto() ? '<button type="button" class="btn" data-act="setPinNow">Set a PIN</button>' : ''}</div><p class="muted small mt8">Text size and themes are in Settings. Tap I got paid on Home every payday to plan the check.</p>`;
    }
    const nav = `<div class="btns">${i ? '<button class="btn" type="button" data-act="wizBack">Back</button>' : '<button class="btn" type="button" data-act="setupSkip">Later</button>'}<button class="btn primary" type="submit">${step === 'done' ? 'Finish' : 'Next'}</button></div>`;
    openSheet(`<p class="label">Step ${i + 1} of ${WIZ.length}</p><h2>${WIZT[step]}</h2><form data-form="wiz">${body}${nav}</form>`);
    const pn = $('#sheet .panel'); if (pn) pn.scrollTop = 0;
  }
  function wizSave(step, fd) {
    const b = budgetOf(), has = (k) => fd.get(k) !== null && String(fd.get(k)).trim() !== '';
    if (step === 'pay') {
      const f = fd.get('freq') || 'biweekly', per = C.num(fd.get('per'));
      if (S.mode === 'summer') { S.budget.summer.freq = f; if (has('per')) S.budget.summer.pay = C.round2(per); }
      else { S.payFreq = f; if (has('per')) S.budget.school.income = C.round2(per * PER_MONTH[f]); }
    } else if (step === 'accounts') {
      const put = (type, id, name, raw) => {
        if (raw === null || String(raw).trim() === '') return;
        const val = C.round2(C.num(raw)); const a = S.accounts.find((x) => x.type === type);
        if (a) a.balance = val; else S.accounts.push({ id, name, last4: '', type, balance: val });
      };
      put('checking', 'chk', 'Checking', fd.get('bal')); put('savings', 'sav', 'Savings', fd.get('sav'));
      S.accounts.filter((a) => a.type === 'card').forEach((a) => {
        if (fd.get('cn_' + a.id) === null) return;
        a.name = String(fd.get('cn_' + a.id)).trim() || a.name;
        const l4 = String(fd.get('cl_' + a.id) || '').trim(); a.last4 = /^\d{4}$/.test(l4) ? l4 : '';
        a.balance = C.round2(C.num(fd.get('cb_' + a.id)));
      });
      if (fd.get('src') !== null) S.paySource = fd.get('src') === 'savings' ? 'savings' : 'checking';
      if (fd.get('src') !== null) { S.autoBal = !!fd.get('auto'); if (S.autoBal) S.balSince = C.today(); }
    } else if (step === 'budget') {
      if (fd.get('fw') === null) return;
      const fw = C.num(fd.get('fw')); S.budget.school.foodWeek = fw; S.budget.summer.foodWeek = fw;
      const roll = !!fd.get('roll'); if (roll && !S.rollover) S.rollSince = C.weekStart(C.today()); S.rollover = roll;
      S.cats.forEach((c) => { const v = fd.get('c_' + c.id); if (v === null) return; b.amounts[c.id] = C.num(v); if (!mahi()) S.budget.summer.amounts[c.id] = C.num(v); });
    } else if (step === 'bills') {
      S.bills.forEach((x) => {
        if (fd.get('bn_' + x.id) === null) return;
        x.name = String(fd.get('bn_' + x.id)).trim(); x.amount = C.round2(C.num(fd.get('ba_' + x.id)));
        x.day = Math.max(0, Math.min(31, Math.round(C.num(fd.get('bd_' + x.id))))) || null; x.cat = fd.get('bc_' + x.id) || x.cat;
      });
      S.bills = S.bills.filter((x) => x.name);
      // A category budget should never be lower than the bills that land in it.
      const need = {}; S.bills.forEach((x) => { need[x.cat] = C.round2((need[x.cat] || 0) + x.amount); });
      Object.keys(need).forEach((c) => { if (c !== 'other' && (b.amounts[c] || 0) < need[c]) { b.amounts[c] = need[c]; if (!mahi()) S.budget.summer.amounts[c] = need[c]; } });
    } else if (step === 'goals') {
      Object.keys(b.savings).forEach((k) => { if (fd.get('sv_' + k) !== null) b.savings[k] = C.num(fd.get('sv_' + k)); });
      ['mom', 'ins', 'trip'].forEach((k) => { if (fd.get('gt_' + k) !== null) S.goals[k].target = Math.max(0, C.num(fd.get('gt_' + k))); });
      const d = fd.get('gd_ins'); if (d !== null) { S.goals.ins.due = d || ''; if (d && !S.goals.ins.start) S.goals.ins.start = C.addMonths(d, -6); }
      S.setupDone = true; S.setupV = 2;
    }
  }
  const wizForm = () => { const f = $('#sheet form[data-form=wiz]'); if (f) wizSave(ui.wiz, new FormData(f)); };

  function addSheet(id, preCat) {
    const e = id ? S.expenses.find((x) => x.id === id) : null;
    const cat = e ? e.cat : preCat || (isFlex(ui.lastCat) ? ui.lastCat : 'food'), acct = e ? e.account : S.lastAccount;
    ui.rcpt = null; ui.rcptDel = false; ui.rcptFor = e ? e.id : null;
    openSheet(`<h2>${e ? 'Edit expense' : 'Add expense'}</h2><form data-form="expense"><input type="hidden" name="id" value="${id || ''}">
      <input class="amount" name="amount" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${e ? e.amount.toFixed(2) : ''}" required>
      <label class="f">Spending money</label><div class="chips">${S.cats.filter((c) => c.kind === 'flex').map((c) => `<input type="radio" id="c_${c.id}" name="cat" value="${c.id}" ${c.id === cat ? 'checked' : ''}><label for="c_${c.id}">${esc(c.name)}</label>`).join('')}</div>
      <label class="f">Bills and gas</label><div class="chips">${S.cats.filter((c) => c.kind !== 'flex').map((c) => `<input type="radio" id="c_${c.id}" name="cat" value="${c.id}" ${c.id === cat ? 'checked' : ''}><label for="c_${c.id}">${esc(c.name)}</label>`).join('')}</div>
      <label class="f">Note</label><input type="text" name="note" autocomplete="off" placeholder="Optional" value="${esc(e ? e.note : '')}">
      <label class="f">Receipt photo</label><div id="rcptbox">${rcptBoxHTML()}</div><input type="file" id="rcptfile" accept="image/*" hidden>
      <label class="f">Card or account</label><select name="account">${S.accounts.map((a) => `<option value="${a.id}" ${a.id === acct ? 'selected' : ''}>${esc(a.name)}${a.last4 ? ' ' + esc(a.last4) : ''}</option>`).join('')}<option value="cash" ${acct === 'cash' ? 'selected' : ''}>Cash or other</option></select>
      <label class="f">Date</label><input type="date" name="date" value="${e ? e.date : C.today()}">
      <label class="mt check"><input type="checkbox" name="forOther" data-toggle="personbox" ${e && e.forOther ? 'checked' : ''}>Bought for someone else</label>
      <div id="personbox" ${e && e.forOther ? '' : 'hidden'}><input type="text" name="person" placeholder="Who owes you?" autocomplete="off" value="${esc(e ? e.forOther : '')}"></div>
      <label class="check"><input type="checkbox" name="oneTime" ${e && e.paidFromSavings ? 'checked' : ''}>One time, paid from savings</label>
      <label class="check"><input type="checkbox" name="household" ${e && e.household ? 'checked' : ''}>Household charge, ignore it</label>
      <div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>
      ${e ? `<button class="mt btn danger" type="button" data-act="delExp" data-id="${e.id}">Delete expense</button>` : ''}</form>`);
    const a = $('#sheet input[name=amount]'); if (a && !e) setTimeout(() => a.focus(), 50);
    if (preCat === 'gas' && !e) { const h2 = $('#sheet h2'); if (h2) h2.textContent = 'Log a fill up'; }
  }

  // ---------- forms ----------
  const forms = {
    cover(fd) {
      const amount = C.round2(C.num(fd.get('amount')));
      if (!(amount > 0)) { toast('Enter an amount'); return; }
      (S.covers = S.covers || []).push({ id: uid(), ws: fd.get('ws'), amount, date: C.today() });
      save(); closeSheet(); render(); toast(fm(amount) + ' covered with savings');
    },
    expense(fd) {
      const amount = C.round2(C.num(fd.get('amount')));
      if (!(amount > 0)) { toast('Enter an amount'); return; }
      const id = fd.get('id'), cat = fd.get('cat') || 'other';
      const forOther = !!fd.get('forOther'), person = (fd.get('person') || '').trim();
      if (forOther && !person) { toast('Who was it for?'); return; }
      const rec = { amount, cat, note: (fd.get('note') || '').trim(), account: fd.get('account'), date: fd.get('date') || C.today(), paidFromSavings: !!fd.get('oneTime'), household: !!fd.get('household'), forOther: forOther ? person : '', takeout: cat === 'food' && !fd.get('household') };
      let exp = id ? S.expenses.find((x) => x.id === id) : null, msg = 'Saved';
      if (exp) { revertBal(exp); Object.assign(exp, rec); } else { exp = Object.assign({ id: uid(), source: 'manual' }, rec); S.expenses.push(exp); }
      applyBal(exp);
      if (ui.rcpt) { const id2 = exp.id, data = ui.rcpt; exp.receipt = true; V.putFile(id2, data).catch(() => toast('Could not save the photo')); }
      else if (ui.rcptDel && exp.receipt) { exp.receipt = false; V.delFile(exp.id); }
      ui.rcpt = null; ui.rcptDel = false;
      let iou = S.ious.find((i) => i.expenseId === exp.id);
      if (forOther) {
        const reason = rec.note || catName(cat);
        if (iou) { if (!iou.payments.length) { iou.person = person; iou.amount = amount; iou.date = rec.date; } iou.reason = reason; }
        else { S.ious.push({ id: uid(), person, dir: 'owedToMe', amount, reason, date: rec.date, payments: [], settled: false, expenseId: exp.id }); msg = 'Saved. IOU created for ' + person; }
      } else if (iou && !iou.payments.length) S.ious = S.ious.filter((i) => i !== iou);
      S.lastAccount = rec.account; ui.lastCat = cat;
      save(); closeSheet(); render(); toast(msg);
    },
    iou(fd) {
      const amount = C.round2(C.num(fd.get('amount'))), person = (fd.get('person') || '').trim();
      if (!(amount > 0) || !person) { toast('Add a person and an amount'); return; }
      S.ious.push({ id: uid(), person, dir: fd.get('dir'), amount, reason: (fd.get('reason') || '').trim(), date: fd.get('date') || C.today(), payments: [], settled: false });
      save(); closeSheet(); render(); toast('IOU added');
    },
    pay(fd) {
      const i = S.ious.find((x) => x.id === fd.get('id')); if (!i) return;
      const amt = C.round2(C.num(fd.get('amount')));
      if (!(amt > 0)) { toast('Enter an amount'); return; }
      i.payments.push({ date: fd.get('date') || C.today(), amount: Math.min(amt, remaining(i)) });
      if (remaining(i) <= 0.004) i.settled = true;
      save(); closeSheet(); render(); toast(i.settled ? 'Settled' : 'Payment logged');
    },
    contrib(fd) {
      const amt = C.round2(C.num(fd.get('amount')));
      if (!(amt > 0)) { toast('Enter an amount'); return; }
      S.goals[fd.get('k')].contribs.push({ id: uid(), date: fd.get('date') || C.today(), amount: amt, note: (fd.get('note') || '').trim() });
      save(); closeSheet(); render(); toast('Logged');
    },
    bonus(fd) {
      const amt = C.round2(C.num(fd.get('amount')));
      if (!(amt > 0)) { toast('Enter an amount'); return; }
      const k = fd.get('k'); ui.bonusGoal = k;
      S.goals[k].contribs.push({ id: uid(), date: fd.get('date') || C.today(), amount: amt, note: fd.get('src') || 'Bonus', bonus: true });
      save(); closeSheet(); render(); toast('Sent ' + fm(amt) + ' to ' + S.goals[k].name);
    },
    goaledit(fd) {
      const g = S.goals[fd.get('k')];
      g.target = Math.max(0, C.num(fd.get('target')));
      if (fd.get('k') === 'ins') { const d = fd.get('due'); g.due = d || ''; if (d) g.start = C.addMonths(d, -6); }
      save(); closeSheet(); render();
    },
    bill(fd) {
      const name = (fd.get('name') || '').trim(), amount = C.round2(C.num(fd.get('amount')));
      if (!name || !(amount > 0)) { toast('Add a name and amount'); return; }
      const day = Math.max(0, Math.min(31, Math.round(C.num(fd.get('day'))))) || null;
      const id = fd.get('id');
      if (id) Object.assign(S.bills.find((b) => b.id === id), { name, amount, day, cat: fd.get('cat') });
      else S.bills.push({ id: uid(), name, amount, day, cat: fd.get('cat') });
      save(); closeSheet(); render();
    },
    acct(fd) {
      const name = (fd.get('name') || '').trim(), last4 = (fd.get('last4') || '').trim();
      if (!name) { toast('Add a nickname'); return; }
      if (last4 && !/^\d{4}$/.test(last4)) { toast('Last 4 must be exactly 4 digits'); return; }
      const id = fd.get('id'), rec = { name, last4, type: fd.get('type'), balance: C.round2(C.num(fd.get('balance'))) };
      if (id) Object.assign(S.accounts.find((a) => a.id === id), rec); else S.accounts.push(Object.assign({ id: uid() }, rec));
      save(); closeSheet(); render();
    },
    rule(fd) {
      const m = (fd.get('match') || '').trim(); if (!m) return;
      S.rules.push({ match: m, cat: fd.get('cat') }); save(); render(); toast('Rule added');
    },
    csvmap(fd) {
      const im = ui.imp;
      im.map = { sig: im.sig, date: +fd.get('date'), desc: +fd.get('desc'), amount: +fd.get('amount'), sign: fd.get('sign') };
      S.csvMap = im.map; save(); csvToReview(); render();
    },
    afford(fd, form) { /* live only */ },
    wiz(fd) {
      wizSave(ui.wiz, fd);
      const i = WIZ.indexOf(ui.wiz);
      if (ui.wiz === 'done') { S.setupDone = true; S.setupV = 2; save(); closeSheet(); render(); toast('All set'); return; }
      save(); render(); wizShow(WIZ[i + 1]);
    },
    paycheck(fd) {
      const amount = C.round2(C.num(fd.get('amount'))), date = fd.get('date') || C.today();
      if (!(amount > 0)) { toast('Enter the amount'); return; }
      const p = payPlan(amount, date);
      S.paychecks = S.paychecks || []; S.paychecks.push({ id: uid(), date, amount });
      if (fd.get('toGoals')) p.goals.forEach((g) => { if (S.goals[g.k]) S.goals[g.k].contribs.push({ id: uid(), date, amount: g.v, note: 'From paycheck' }); });
      if (fd.get('toChk')) { const a = S.accounts.find((x) => x.type === 'checking'); if (a) a.balance = C.round2((a.balance || 0) + amount); }
      save(); closeSheet(); render(); toast('Paycheck logged');
    },
    paycard(fd) {
      const c = S.accounts.find((x) => x.id === fd.get('id')), src = S.accounts.find((x) => x.id === fd.get('from'));
      const amt = C.round2(C.num(fd.get('amount')));
      if (!c || !(amt > 0)) { toast('Enter an amount'); return; }
      c.balance = C.round2((c.balance || 0) - amt);
      if (src) src.balance = C.round2((src.balance || 0) - amt);
      S.transfers = S.transfers || []; S.transfers.push({ id: uid(), date: fd.get('date') || C.today(), from: src ? src.id : '', to: c.id, amount: amt });
      save(); closeSheet(); render(); toast('Payment logged');
    },
    async setup(fd) {
      if (fd.get('nolock')) {
        $('#lockbtn').disabled = true;
        S = defaultState();
        await V.createAuto(S);
        setPinHint(false);
        startSession();
        return;
      }
      const p = fd.get('p') || '', p2 = fd.get('p2') || '', err = $('#lockerr');
      if (!/^\d{6}$/.test(p)) { err.textContent = 'Use exactly 6 digits'; return; }
      if (p !== p2) { err.textContent = 'PINs do not match'; return; }
      setPinHint(true);
      err.textContent = ''; $('#lockbtn').textContent = 'Creating'; $('#lockbtn').disabled = true;
      S = fd.get('persona') === 'blank' ? blankState() : defaultState();
      await V.create(p, S);
      startSession();
    },
    async unlock(fd) {
      const err = $('#lockerr'); err.textContent = ''; $('#lockbtn').disabled = true; $('#lockbtn').textContent = 'Checking';
      try { const st = await V.unlock(fd.get('p') || ''); S = Object.assign(defaultState(), st || {}); startSession(); }
      catch (e) { fails++; await new Promise((r) => setTimeout(r, Math.min(4000, fails * 600))); err.textContent = pinHintOn() ? 'That PIN is not right' : 'That passcode is not right'; const pf = $('input[name=p]'); if (pf) { pf.value = ''; pf.focus(); } $('#lockbtn').disabled = false; $('#lockbtn').textContent = 'Unlock'; }
    },
    async setpin(fd) {
      const n = fd.get('n') || '';
      if (!/^\d{6}$/.test(n)) { toast('Use exactly 6 digits'); return; }
      if (n !== fd.get('n2')) { toast('PINs do not match'); return; }
      try { await flush(); await V.setPass(n, S); setPinHint(true); closeSheet(); render(); toast('PIN is on'); }
      catch (e) { toast(e.message); }
    },
    async rmpin(fd) {
      try { await flush(); await V.makeAuto(fd.get('o') || '', S); setPinHint(false); closeSheet(); render(); toast('PIN removed'); }
      catch (e) { toast(e.message); }
    },
    async chpass(fd) {
      const n = fd.get('n') || '';
      if (!/^\d{6}$/.test(n)) { toast('Use exactly 6 digits'); return; }
      if (n !== fd.get('n2')) { toast('New PINs do not match'); return; }
      try { await flush(); await V.changePass(fd.get('o') || '', n, S); setPinHint(true); closeSheet(); toast('PIN changed. Face ID was turned off.'); fillFaceBox(); }
      catch (e) { toast(e.message); }
    },
    async faceon(fd) {
      try { await V.enableFace(fd.get('p') || ''); closeSheet(); toast('Face ID is on'); fillFaceBox(); }
      catch (e) { toast(e.message); }
    },
    async restore(fd) {
      try {
        S = Object.assign(defaultState(), await V.importBackup(ui.pendingBackup, fd.get('p') || ''));
        setPinHint(!V.isAuto() && /^\d{6}$/.test(fd.get('p') || ''));
        ui.pendingBackup = null; closeSheet(); toast('Backup restored'); render();
      } catch (e) { toast(e.message || 'Could not restore'); }
    }
  };
  let fails = 0;

  // ---------- actions ----------
  const actions = {
    tab(d) { ui.tab = d.t; ui.more = null; render(); window.scrollTo(0, 0); },
    mode(d) { S.mode = d.m; save(); render(); },
    settings() { ui.tab = 'more'; ui.more = 'security'; render(); fillFaceBox(); window.scrollTo(0, 0); },
    add() { addSheet(); },
    logGas() { addSheet(null, 'gas'); },
    moveLeftover(d) {
      const lo = LO(), amt = leftoverOf(d.mk); if (!(amt > 0)) return;
      lo.moved[d.mk] = amt;
      S.goals.gen.contribs.push({ id: uid(), date: C.today(), amount: amt, note: 'Left over from ' + C.monthName(d.mk) });
      if (S.autoBal) {
        const chk = S.accounts.find((a) => a.type === 'checking'), sav = S.accounts.find((a) => a.type === 'savings');
        if (chk && sav) { chk.balance = C.round2((chk.balance || 0) - amt); sav.balance = C.round2((sav.balance || 0) + amt); }
      }
      save(); render(); toast(fm(amt) + ' added to savings');
    },
    addType() { S.cats.splice(S.cats.findIndex((c) => c.id === 'other'), 0, { id: uid(), name: 'New type', kind: 'flex' }); save(); render(); },
    delType(d) {
      const n = S.expenses.filter((e) => e.cat === d.id).length, c = S.cats.find((x) => x.id === d.id); if (!c) return;
      if (!confirm(n ? 'Remove ' + c.name + '? Its ' + n + ' purchase' + (n === 1 ? '' : 's') + ' will move to Other.' : 'Remove ' + c.name + '?')) return;
      S.expenses.forEach((e) => { if (e.cat === d.id) e.cat = 'other'; });
      S.rules.forEach((r) => { if (r.cat === d.id) r.cat = 'other'; });
      S.cats = S.cats.filter((x) => x !== c); save(); render();
    },
    weekDetail() { ui.tab = 'budget'; ui.bview = 'week'; ui.wOff = 0; render(); window.scrollTo(0, 0); },
    editExp(d) { addSheet(d.id); },
    delExp(d) {
      const e = S.expenses.find((x) => x.id === d.id); if (!e) return;
      revertBal(e); if (e.receipt) V.delFile(e.id);
      S.expenses = S.expenses.filter((x) => x !== e);
      S.ious = S.ious.filter((i) => !(i.expenseId === e.id && !i.payments.length));
      save(); closeSheet(); render(); toast('Deleted');
    },
    closeSheet() { closeSheet(); },
    sheetBg(d, el, ev) { if (ev.target === el) closeSheet(); },
    bview(d) { ui.bview = d.v; render(); },
    wnav(d) { ui.wOff = Math.min(0, ui.wOff + +d.d); render(); },
    mnav(d) { ui.mk = C.shiftMonthKey(ui.mk || C.monthKey(C.today()), +d.d); render(); },
    bnav(d) { ui.bmk = C.shiftMonthKey(ui.bmk || C.monthKey(C.today()), +d.d); render(); },
    rnav(d) {
      const t = C.today();
      if ((ui.rper || 'week') === 'week') { const n = C.addDays(ui.rws || C.weekStart(t), 7 * +d.d); if (n <= t) ui.rws = n; }
      else { const n = C.shiftMonthKey(ui.rmk || C.monthKey(t), +d.d); if (n <= C.monthKey(t)) ui.rmk = n; }
      render();
    },
    rper(d) { ui.rper = d.v; render(); },
    async shareReport() {
      const text = reportText(report());
      try {
        if (navigator.share) await navigator.share({ title: 'Spending report', text });
        else { await navigator.clipboard.writeText(text); toast('Copied'); }
      } catch (e) { if (e && e.name !== 'AbortError') toast('Could not share'); }
    },
    async csvReport() {
      const r = report(), q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      const rows = [['Date', 'Description', 'Category', 'Account', 'Amount', 'Counted']].concat(r.all.slice().sort((a, c) => a.date.localeCompare(c.date)).map((e) => {
        const a = S.accounts.find((x) => x.id === e.account);
        return [e.date, e.note || '', catName(e.cat), a ? a.name : '', e.amount.toFixed(2), counted(e) ? 'yes' : 'no'];
      }));
      try { await saveFile(rows.map((x) => x.map(q).join(',')).join('\n'), 'money-' + r.per + '-' + r.from + '.csv', 'text/csv'); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Could not save'); }
    },
    moreHist() { ui.hist += 40; render(); },
    sundayWeek() { ui.tab = 'more'; ui.more = 'recap'; ui.rper = 'week'; ui.rws = C.addDays(C.weekStart(C.today()), -7); render(); },
    sundayIous() { ui.tab = 'ious'; render(); },
    setPinNow() {
      openSheet(`<h2>Set a PIN</h2><form data-form="setpin"><label class="f">New 6 digit PIN</label><input type="password" name="n" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required><label class="f">Repeat PIN</label><input type="password" name="n2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Set PIN</button></div></form>`);
    },
    removePin() {
      openSheet(`<h2>Remove PIN</h2><p class="muted">The app will open without asking for anything. Your data stays on this phone, but anyone who opens the app can see it.</p><form data-form="rmpin"><label class="f">Current PIN</label><input type="password" name="o" autocomplete="current-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn danger" type="submit">Remove</button></div></form>`);
    },
    setupMahi() { setupForm(); },
    setupNew() {
      S = Object.assign(blankState(), { expenses: S.expenses, ious: S.ious, accounts: S.accounts, lastBackup: S.lastBackup, paySource: S.paySource, lastAccount: S.lastAccount, dismissed: S.dismissed });
      save(); setupForm();
    },
    setupSkip() { wizForm(); S.setupDone = true; S.dismissed.v2 = true; save(); closeSheet(); render(); },
    dismissV2() { S.dismissed.v2 = true; save(); render(); },
    dismissGaps() { S.dismissed['gap' + C.monthKey(C.today())] = true; save(); render(); },
    dismissSubs() { S.dismissed['subs' + C.monthKey(C.today())] = true; save(); render(); },
    wizBack() { wizForm(); save(); wizShow(WIZ[Math.max(0, WIZ.indexOf(ui.wiz) - 1)]); },
    wizAddCard() { wizForm(); const n = S.accounts.filter((a) => a.type === 'card').length + 1; S.accounts.push({ id: uid(), name: 'Card ' + n, last4: '', type: 'card', balance: 0 }); save(); wizShow('accounts'); },
    wizRmCard(d) {
      wizForm();
      if (S.expenses.some((e) => e.account === d.id) && !confirm('Purchases are logged on this card. Remove it anyway? The purchases stay.')) return;
      S.accounts = S.accounts.filter((a) => a.id !== d.id); if (S.lastAccount === d.id) S.lastAccount = (S.accounts[0] || {}).id; save(); wizShow('accounts');
    },
    wizAddBill() { wizForm(); S.bills.push({ id: uid(), name: 'New bill', amount: 0, day: null, cat: 'subs' }); save(); wizShow('bills'); },
    wizRmBill(d) { wizForm(); S.bills = S.bills.filter((b) => b.id !== d.id); save(); wizShow('bills'); },
    subKeep(d) { const b = S.bills.find((x) => x.id === d.id); if (b) { b.reviewed = C.today(); save(); render(); toast('Checked. It will ask again in 3 months.'); } },
    subCancel(d) { const b = S.bills.find((x) => x.id === d.id); if (b && confirm('Remove ' + b.name + ' from your bills? Past payments stay in your history.')) { S.bills = S.bills.filter((x) => x !== b); save(); render(); toast('Removed. That saves ' + fm(b.amount * 12) + ' a year.'); } },
    icsOpen() {
      const url = URL.createObjectURL(new Blob([icsText()], { type: 'text/calendar' }));
      const a = document.createElement('a'); a.href = url; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    async icsShare() { try { await saveFile(icsText(), 'money-reminders.ics', 'text/calendar'); } catch (e) { if (e && e.name !== 'AbortError') toast('Could not share'); } },
    fixBudget() {
      const f = $('#sheet form[data-form=paycheck]'); if (!f) return;
      const fd = new FormData(f), amt = C.round2(C.num(fd.get('amount'))), date = fd.get('date') || C.today();
      const p = payPlan(amt, date); if (p.left >= 0) return;
      ui.fixPay = { amt, date };
      const o = fixOptions(-p.left);
      ui.fixOpts = o.opts;
      openSheet(`<h2>Fix the budget</h2><p class="muted">This check is ${fm(-p.left)} short. To cover it every payday, your ${S.mode === 'school' ? 'School year' : 'Summer'} plan needs ${fm(o.cut)} less a month. Pick one:</p>` +
        (o.opts.length ? o.opts.map((x, i) => card(x.t, x.ch.map((c) => `<div class="row item"><span>${esc(c.label)}</span><b>${fm(c.from)} to ${fm(c.to)} <span class="muted small">${c.unit}</span></b></div>`).join('') + `<button class="mt8 btn primary" data-act="fixApply" data-i="${i}">Use this</button>`, 'inset')).join('')
          : '<p class="r">There is not enough in spending money and savings to cover it. Lower a fixed bill in Budget and income, or check your take home amount.</p>') +
        `<button class="mt btn" data-act="fixKeep">Leave the budget, this check was just low</button>`);
    },
    fixApply(d) {
      const x = ui.fixOpts && ui.fixOpts[+d.i]; if (!x) return;
      const b = budgetOf(), wpm = 52 / 12;
      x.ch.forEach((c) => {
        if (c.kind === 'food') b.foodWeek = c.to;
        else if (c.kind === 'cat') b.amounts[c.id] = c.to;
        else b.savings[c.id] = c.to;
      });
      save(); render(); toast('Budget updated'); actions.paycheck(ui.fixPay);
    },
    fixKeep() { actions.paycheck(ui.fixPay); },
    paycheck(pre) {
      const t = pre && pre.date ? pre.date : C.today(), amt = pre && pre.amt ? pre.amt : perCheck(), hasChk = S.accounts.some((a) => a.type === 'checking');
      openSheet(`<h2>I got paid</h2><p class="muted">See where this paycheck should go before you spend any of it.</p><form data-form="paycheck" data-live="pay"><label class="f">Take home amount</label><input class="amount" type="text" inputmode="decimal" name="amount" value="${amt ? amt.toFixed(2) : ''}" placeholder="0.00" autocomplete="off"><label class="f">Payday</label><input type="date" name="date" value="${t}"><div id="payout">${payPlanHTML(amt, t)}</div><label class="mt check"><input type="checkbox" name="toGoals" checked>Log the savings part to my goals</label>${hasChk ? `<label class="check"><input type="checkbox" name="toChk" ${S.autoBal ? 'checked' : ''}>Add it to my checking balance</label>` : ''}<div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
      applyWidths();
    },
    payCard(d) {
      const c = S.accounts.find((x) => x.id === d.id), srcs = S.accounts.filter((a) => a.type !== 'card');
      openSheet(`<h2>Paid ${esc(c.name)}</h2><form data-form="paycard"><input type="hidden" name="id" value="${c.id}"><label class="f">Amount paid</label><input class="amount" type="text" inputmode="decimal" name="amount" value="${(c.balance || 0).toFixed(2)}" autocomplete="off"><label class="f">Paid from</label><select name="from">${srcs.map((a) => `<option value="${a.id}" ${a.type === payType() ? 'selected' : ''}>${esc(a.name)}${a.last4 ? ' ' + esc(a.last4) : ''}</option>`).join('')}<option value="">Somewhere else</option></select><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><p class="muted small">Lowers what the card owes and takes it out of the account you pick.</p><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
    },
    toggleAutoBal(d, el) { S.autoBal = el.checked; if (S.autoBal) S.balSince = C.today(); save(); render(); toast(S.autoBal ? 'Purchases from today on will update balances' : 'Automatic balances off'); },
    coverSheet(d) {
      const ws = d.ws, need = coverNeed(ws), cv = coverOf(ws);
      openSheet(`<h2>Cover with savings</h2><p class="muted">Use savings instead of making the next weeks pay it back. This week's spending money goes up by this amount.</p><form data-form="cover"><input type="hidden" name="ws" value="${ws}"><label class="f">Amount</label><input type="text" inputmode="decimal" name="amount" value="${need.toFixed(2)}"><p class="muted small">It comes out of what you save this month, so your savings goes down by the same amount.</p><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Cover it</button></div></form>${cv ? `<p class="muted small mt">Already covered this week: ${fm(cv)}.</p><button class="mt btn small danger" data-act="uncover" data-ws="${ws}">Undo cover</button>` : ''}`);
    },
    uncover(d) { S.covers = (S.covers || []).filter((c) => c.ws !== d.ws); save(); closeSheet(); render(); toast('Cover removed'); },
    toggleOver(d, el) { S.overCarry = el.checked; if (S.overCarry && !S.overSince) S.overSince = C.weekStart(C.today()); save(); render(); },
    toggleRoll(d, el) { S.rollover = el.checked; if (S.rollover && !S.rollSince) S.rollSince = C.weekStart(C.today()); save(); render(); },
    rcptPick() { $('#rcptfile').click(); },
    rcptClear() { ui.rcpt = null; ui.rcptDel = true; $('#rcptbox').innerHTML = rcptBoxHTML(); },
    async rcptView() {
      const box = $('#rcptbox');
      try { const data = await V.getFile(ui.rcptFor); box.innerHTML = data ? `<img class="thumb big" src="${data}" alt="Receipt"><button type="button" class="mt8 btn small danger" data-act="rcptClear">Remove photo</button>` : '<p class="muted small">Photo not found.</p>'; }
      catch (e) { toast('Could not open the photo'); }
    },
    quickSetup() { setupStart(); },
    dismissBackup() { S.dismissed['bk' + C.today()] = true; save(); render(); },
    dismissSun() { S.dismissed['sun' + C.today()] = true; save(); render(); },
    openMore(d) { if (d.v === 'log') loadLog(true); ui.tab = 'more'; ui.more = d.v; ui.imp = null; render(); window.scrollTo(0, 0); if (d.v === 'security') fillFaceBox(); if (d.v === 'afford') setTimeout(() => { const p = $('input[name=price]'); if (p) p.focus(); }, 50); },
    moreBack() { ui.more = null; ui.imp = null; render(); },
    // IOUs
    addIou() {
      openSheet(`<h2>Add an IOU</h2><form data-form="iou"><label class="f">Direction</label><select name="dir"><option value="owedToMe">They owe me</option><option value="iOwe">I owe them</option></select><label class="f">Person</label><input type="text" name="person" autocomplete="off" required><label class="f">Amount</label><input type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">Reason</label><input type="text" name="reason" autocomplete="off"><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Add</button></div></form>`);
    },
    payIou(d) {
      const i = S.ious.find((x) => x.id === d.id);
      openSheet(`<h2>Partial payment</h2><p class="muted">${esc(i.person)} has ${fm(remaining(i))} left.</p><form data-form="pay"><input type="hidden" name="id" value="${i.id}"><label class="f">Amount paid</label><input class="amount" type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Log</button></div></form>`);
    },
    settleIou(d) {
      const i = S.ious.find((x) => x.id === d.id);
      if (!confirm('Mark ' + i.person + ' as fully paid?')) return;
      const r = remaining(i); if (r > 0) i.payments.push({ date: C.today(), amount: r });
      i.settled = true; save(); render(); toast('Settled');
    },
    delIou(d) { if (confirm('Delete this IOU?')) { S.ious = S.ious.filter((x) => x.id !== d.id); save(); render(); } },
    // goals
    contrib(d) {
      openSheet(`<h2>Add money</h2><p class="muted">${esc(S.goals[d.k].name)}</p><form data-form="contrib"><input type="hidden" name="k" value="${d.k}"><label class="f">Amount</label><input class="amount" type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">Note</label><input type="text" name="note" autocomplete="off" placeholder="Optional"><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Log</button></div></form>`);
    },
    logBonus() {
      const gl = Object.keys(S.goals).map((k) => `<option value="${k}" ${k === (ui.bonusGoal || 'gen') ? 'selected' : ''}>${esc(S.goals[k].name)}</option>`).join('');
      openSheet(`<h2>Log bonus</h2><p class="muted">Tips, gifts, and money from family go straight to a savings goal. It is never counted as income.</p><form data-form="bonus"><label class="f">Amount</label><input class="amount" type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">From</label><div class="chips">${['Tips', 'Dad', 'Other'].map((x, i) => `<input type="radio" id="bs_${i}" name="src" value="${x}" ${i === 0 ? 'checked' : ''}><label for="bs_${i}">${x}</label>`).join('')}</div><label class="f">Send to goal</label><select name="k">${gl}</select><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Log</button></div></form>`);
      const a = $('#sheet input[name=amount]'); if (a) setTimeout(() => a.focus(), 50);
    },
    goalHist(d) {
      const g = S.goals[d.k], list = g.contribs.slice().sort((a, c) => (a.date < c.date ? 1 : -1));
      openSheet(`<h2>${esc(g.name)}</h2>${list.length ? list.map((c) => `<div class="item row"><span>${C.shortDate(c.date)} ${esc(c.note)}<br><b>${fm(c.amount)}</b></span><button class="btn small danger" data-act="delContrib" data-k="${d.k}" data-id="${c.id}">Delete</button></div>`).join('') : '<p class="muted">No contributions yet.</p>'}<button class="mt14 btn" data-act="closeSheet">Close</button>`);
    },
    delContrib(d) { if (!confirm('Delete this entry?')) return; const g = S.goals[d.k]; g.contribs = g.contribs.filter((c) => c.id !== d.id); save(); closeSheet(); render(); },
    goalEdit(d) {
      const g = S.goals[d.k], label = d.k === 'mom' ? 'Total you owe' : 'Target';
      openSheet(`<h2>Edit ${esc(g.name)}</h2><form data-form="goaledit"><input type="hidden" name="k" value="${d.k}"><label class="f">${label}</label><input type="text" inputmode="decimal" name="target" value="${g.target || ''}" autocomplete="off">${d.k === 'ins' ? `<label class="f">Bill due date</label><input type="date" name="due" value="${g.due || ''}">` : ''}<div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
    },
    insNext() { const g = S.goals.ins; if (!g.due) return; g.start = g.due; g.due = C.addMonths(g.due, 6); save(); render(); toast('Next cycle started'); },
    // bills
    billPaid(d) {
      const mk = ui.bmk || C.monthKey(C.today()), b = S.bills.find((x) => x.id === d.id);
      if (billPaid(b, mk)) S.expenses = S.expenses.filter((e) => { const hit = e.billId === b.id && C.monthKey(e.date) === mk; if (hit) revertBal(e); return !hit; });
      else { const e = { id: uid(), amount: b.amount, cat: b.cat, note: b.name, account: S.lastAccount, date: mk === C.monthKey(C.today()) ? C.today() : mk + '-01', paidFromSavings: false, forOther: '', takeout: false, billId: b.id, source: 'bill' }; S.expenses.push(e); applyBal(e); }
      save(); render();
    },
    addBill() { billSheet(); },
    editBill(d) { billSheet(d.id); },
    delBill(d) { S.bills = S.bills.filter((b) => b.id !== d.id); save(); closeSheet(); render(); },
    // household
    addHh() { S.household.items.push({ id: uid(), name: 'New bill', amount: 0 }); save(); render(); },
    delHh(d) { if (!confirm('Remove this bill?')) return; S.household.items.splice(+d.i, 1); save(); render(); },
    // accounts
    addAcct() { acctSheet(); },
    editAcct(d) { acctSheet(d.id); },
    delAcct(d) { S.accounts = S.accounts.filter((a) => a.id !== d.id); save(); closeSheet(); render(); },
    delRule(d) { if (!confirm('Delete this rule?')) return; S.rules.splice(+d.i, 1); save(); render(); },
    // import
    pickCsv() { $('#csvfile').click(); },
    pickImg() { $('#imgfile').click(); },
    impCancel() { ui.imp = null; render(); },
    impSave() {
      const acct = $('#impacct').value, im = ui.imp; let n = 0;
      im.items.forEach((x) => {
        if (!x.on || !(x.amount > 0)) return;
        const hh = x.cat === '__hh';
        const e = { id: uid(), amount: C.round2(x.amount), cat: hh ? 'other' : x.cat, note: x.desc, account: acct, date: x.date, paidFromSavings: false, household: hh, forOther: '', takeout: x.cat === 'food', source: im.kind };
        S.expenses.push(e); applyBal(e);
        n++;
      });
      S.lastAccount = acct; ui.imp = null; save(); render(); toast(n + ' saved');
    },
    // security
    lockNow() { lock(); },
    changePass() {
      openSheet(`<h2>Change PIN</h2><form data-form="chpass"><label class="f">Current passcode or PIN</label><input type="password" name="o" autocomplete="current-password" required><label class="f">New 6 digit PIN</label><input type="password" name="n" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required><label class="f">Repeat new PIN</label><input type="password" name="n2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Change</button></div></form>`);
    },
    faceOn() {
      openSheet(`<h2>Turn on Face ID</h2><p class="muted">Enter your PIN once to link it.</p><form data-form="faceon"><input type="password" name="p" autocomplete="current-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Continue</button></div></form>`);
    },
    async faceOff() { await V.disableFace(); toast('Face ID is off'); fillFaceBox(); },
    async exportBackup() {
      try {
        await flush();
        const text = await V.exportBackup(), name = 'money-backup-' + C.today() + '.json';
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Money backup' });
        else { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
        S.lastBackup = C.today(); save(); render();
      } catch (e) { if (e && e.name !== 'AbortError') toast('Backup failed'); }
    },
    pickBackup() { $('#bkfile').click(); },
    blankNow() {
      if (!confirm('Replace the preloaded budget, bills, goals, and rules with blank ones?')) return;
      S = Object.assign(blankState(), { expenses: S.expenses, ious: S.ious, accounts: S.accounts, lastBackup: S.lastBackup, setupDone: S.setupDone, paySource: S.paySource, lastAccount: S.lastAccount, dismissed: S.dismissed });
      save(); ui.more = null; ui.tab = 'home'; render(); toast('Blank setup ready. Set your budget in More.');
    },
    erase() {
      if (!confirm('Erase all data on this device? This cannot be undone.')) return;
      if (!confirm('Really erase everything? Make sure you have a backup.')) return;
      V.wipe().then(() => { S = null; ui = { tab: 'home', bview: 'week', wOff: 0, mk: null, more: null, imp: null, bmk: null, rmk: null, hist: 40, lastCat: 'food', pendingBackup: null }; showLock(); });
    }
  };

  function billSheet(id) {
    const b = id ? S.bills.find((x) => x.id === id) : null;
    openSheet(`<h2>${b ? 'Edit bill' : 'Add a bill'}</h2><form data-form="bill"><input type="hidden" name="id" value="${id || ''}"><label class="f">Name</label><input type="text" name="name" value="${esc(b ? b.name : '')}" required><label class="f">Amount</label><input type="text" inputmode="decimal" name="amount" value="${b ? b.amount : ''}" required><label class="f">Due day of the month</label><input type="number" name="day" min="1" max="31" value="${b && b.day ? b.day : ''}" placeholder="1 to 31"><label class="f">Category</label><select name="cat">${S.cats.map((c) => `<option value="${c.id}" ${b && b.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>${b ? `<button class="mt btn danger" type="button" data-act="delBill" data-id="${b.id}">Delete bill</button>` : ''}</form>`);
  }
  function acctSheet(id) {
    const a = id ? S.accounts.find((x) => x.id === id) : null;
    openSheet(`<h2>${a ? 'Edit account' : 'Add a card or account'}</h2><p class="muted">Nickname and last 4 digits only. Never enter full numbers.</p><form data-form="acct"><input type="hidden" name="id" value="${id || ''}"><label class="f">Nickname</label><input type="text" name="name" value="${esc(a ? a.name : '')}" required><label class="f">Last 4 digits</label><input type="text" name="last4" inputmode="numeric" maxlength="4" value="${esc(a ? a.last4 : '')}"><label class="f">Type</label><select name="type"><option value="card" ${a && a.type === 'card' ? 'selected' : ''}>Credit card</option><option value="checking" ${a && a.type === 'checking' ? 'selected' : ''}>Checking</option><option value="savings" ${a && a.type === 'savings' ? 'selected' : ''}>Savings</option></select><label class="f">Balance</label><input type="text" inputmode="decimal" name="balance" value="${a ? a.balance || '' : ''}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>${a && S.accounts.length > 1 ? `<button class="mt btn danger" type="button" data-act="delAcct" data-id="${a.id}">Delete</button>` : ''}</form>`);
  }

  // ---------- events ----------
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const fn = actions[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') { fn(el.dataset, el, ev); return; }
    fn(el.dataset, el, ev);
  });
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form[data-form]'); if (!f) return;
    ev.preventDefault();
    const fn = forms[f.dataset.form]; if (fn) { const fd = new FormData(f); if (ev.submitter && ev.submitter.name) fd.set(ev.submitter.name, ev.submitter.value); fn(fd, f); }
  });
  document.addEventListener('input', (ev) => {
    const f = ev.target.closest('form[data-live=afford]');
    if (f) { const fd = new FormData(f); $('#affout').innerHTML = affordHTML(C.num(fd.get('price')), fd.get('cat')); applyWidths(); }
    const pf = ev.target.closest('form[data-live=pay]');
    if (pf) { const fd = new FormData(pf); $('#payout').innerHTML = payPlanHTML(C.num(fd.get('amount')), fd.get('date') || C.today()); }
    if (ev.target.id === 'hq') { ui.hq = ev.target.value; ui.hist = 40; $('#histlist').innerHTML = histListHTML(); }
  });
  // Redraw only when no form box on the page has focus, so tapping from one box
  // to the next does not close the keyboard.
  let pendingRender = false;
  function renderWhenIdle() {
    const a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.closest('.screen')) { pendingRender = true; return; }
    pendingRender = false; render();
  }
  document.addEventListener('focusout', () => { if (pendingRender) setTimeout(renderWhenIdle, 0); });
  function setPath(path, val) {
    const p = path.split('.'); let o = S;
    for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = val;
  }
  document.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.path) {
      setPath(el.dataset.path, el.dataset.t === 'n' ? C.round2(C.num(el.value)) : el.value);
      save();
      if (el.dataset.re) { if (el.tagName === 'SELECT') render(); else setTimeout(renderWhenIdle, 0); }
      return;
    }
    if (el.dataset && el.dataset.toggle) { const box = $('#' + el.dataset.toggle); if (box) box.hidden = !el.checked; return; }
    if (el.dataset && el.dataset.ri !== undefined && ui.imp && ui.imp.items) {
      const x = ui.imp.items[+el.dataset.ri], f = el.dataset.f;
      if (f === 'on') x.on = el.checked; else if (f === 'amount') x.amount = Math.abs(C.num(el.value)); else x[f] = el.value;
      if (f === 'on' || f === 'amount') render();
      return;
    }
    if (el.id === 'hcat' || el.id === 'hrng') { ui[el.id] = el.value; ui.hist = 40; $('#histlist').innerHTML = histListHTML(); return; }
    if (el.id === 'rtc') { ui.rtc = el.value; render(); return; }
    if (el.id === 'rcptfile' && el.files[0]) {
      const f = el.files[0]; el.value = '';
      try { ui.rcpt = await shrinkImage(f); ui.rcptDel = false; $('#rcptbox').innerHTML = rcptBoxHTML(); } catch (e) { toast('Could not read that photo'); }
      return;
    }
    if (el.id === 'csvfile' && el.files[0]) { try { await handleCsv(el.files[0]); } catch (e) { toast('Could not read that file'); } el.value = ''; }
    if (el.id === 'imgfile' && el.files[0]) { const f = el.files[0]; el.value = ''; await handleImg(f); }
    if (el.id === 'bkfile' && el.files[0]) {
      try { ui.pendingBackup = await el.files[0].text(); JSON.parse(ui.pendingBackup); } catch (e) { toast('That is not a backup file'); return; }
      el.value = '';
      openSheet(`<h2>Restore backup</h2><p class="muted">This replaces everything on this device with the backup. Enter the PIN the backup was made with. Leave it empty if the backup was made with no PIN.</p><form data-form="restore"><input type="password" name="p" autocomplete="current-password" placeholder="PIN, or empty"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Restore</button></div></form>`);
    }
  });

  // ---------- lock / session ----------
  function showLock(forceUnlock) {
    V.exists().then(async (exists) => {
      if (exists && (await V.mode()) === 'auto') {
        try { const st = await V.unlockAuto(); S = Object.assign(defaultState(), st || {}); startSession(); return; } catch (e) { /* fall through to the normal screen */ }
      }
      const face = exists && (await V.faceEnabled());
      const pin = exists && getPinHint();
      $('#app').innerHTML = `<div class="lock"><h1>${exists ? 'Welcome back' : 'Create a PIN'}</h1><p class="muted">${exists ? (pin ? 'Enter your PIN to unlock.' : 'Enter your passcode to unlock.') : 'Choose a 6 digit PIN. '}${exists ? '' : 'This encrypts everything on this device. If you forget it, the data cannot be recovered, so keep a backup.'}</p><form data-form="${exists ? 'unlock' : 'setup'}"><input type="password" name="p" ${pin || !exists ? 'inputmode="numeric" pattern="[0-9]*" maxlength="6"' : ''} ${pin ? 'data-auto="1"' : ''} autocomplete="${exists ? 'current-password' : 'new-password'}" placeholder="${pin || !exists ? 'PIN' : 'Passcode'}" required>${exists ? '' : '<input type="password" name="p2" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="new-password" placeholder="Repeat PIN" class="mt" required>'}<div class="err" id="lockerr"></div><button class="btn primary" id="lockbtn" type="submit">${exists ? 'Unlock' : 'Create'}</button>${exists ? '' : '<button class="mt btn" name="nolock" value="1" type="submit" formnovalidate>Skip, no PIN</button>'}${exists ? '' : '<button class="mt btn" name="persona" value="blank" type="submit">I\'m not Mahi</button><p class="mt12 muted small">Mahi\'s budget numbers are preloaded. Tap I\'m not Mahi for a blank setup where you enter your own numbers.</p>'}</form>${face ? '<button class="mt12 btn" data-act="faceUnlock">Unlock with Face ID</button>' : ''}</div>`;
      const p = $('input[name=p]'); if (p) setTimeout(() => p.focus(), 50);
      if (face && !forceUnlock) { /* user taps the button to start Face ID */ }
    });
  }
  actions.faceUnlock = async () => {
    try { const st = await V.unlockFace(); S = Object.assign(defaultState(), st || {}); startSession(); }
    catch (e) { const err = $('#lockerr'); if (err) err.textContent = 'Face ID did not work. Use your passcode.'; }
  };
  function startSession() {
    fails = 0; hiddenAt = 0; ui.tab = 'home'; ui.more = null;
    if (S.autoBal && !S.balSince) { S.balSince = C.today(); save(); }
    applyBudgetNov2026();
    removeDadPayment();
    poolSpending();
    addSpendTypes();
    momStrict();
    overCarryOn();
    loadLog();
    LO();
    try {
      const up = sessionStorage.getItem('moneyUpdated');
      if (up) { sessionStorage.removeItem('moneyUpdated'); const u = JSON.parse(up); ui.tab = u.tab || 'home'; ui.more = u.more || null; setTimeout(() => { toast('Updated to the newest version'); if (ui.more === 'security') fillFaceBox(); }, 400); }
    } catch (e) {}
    render();
    if (!S.setupDone && !S.expenses.length) { if (S.persona === 'blank') setupForm(); else setupStart(); }
  }
  // One time update to Mahi's budget (November 2026). Only budget numbers change; all logged data stays.
  function applyBudgetNov2026() {
    if (S.persona === 'blank' || S.budgetNov2026) return;
    const amounts = { gas: 150, insurance: 200, flexpay: 53.66, dad: 136.82, phone: 54, gym: 25, haircut: 42, subs: 41.99, food: 240, amazon: 0 };
    ['school', 'summer'].forEach((m) => { Object.assign(S.budget[m].amounts, amounts); S.budget[m].foodWeek = 60; });
    const bills = { Windscribe: 2, 'Google Photos': 2, Spotify: 12.99, 'Snapchat Premium': 5, Claude: 20, Phone: 54, Gym: 25, 'Flex pay': 53.66, 'Car insurance fund': 200 };
    S.bills.forEach((b) => { if (bills[b.name] !== undefined) b.amount = bills[b.name]; });
    S.budgetNov2026 = true; save();
    setTimeout(() => toast('Budget updated: $943.47 a month'), 600);
  }
  // One time: Dad's payment is no longer part of the budget.
  function removeDadPayment() {
    if (S.persona === 'blank' || S.noDadPay) return;
    ['school', 'summer'].forEach((m) => { S.budget[m].amounts.dad = 0; });
    S.bills = S.bills.filter((b) => b.cat !== 'dad');
    if (!S.expenses.some((e) => e.cat === 'dad')) S.cats = S.cats.filter((c) => c.id !== 'dad');
    S.noDadPay = true; save();
    setTimeout(() => toast("Dad's payment removed: budget is $806.65 a month"), 700);
  }
  // One time: food, shopping, and other share one weekly limit instead of separate monthly amounts.
  function poolSpending() {
    if (S.poolSpend) return;
    ['school', 'summer'].forEach((m) => { S.cats.forEach((c) => { if (c.kind === 'flex') S.budget[m].amounts[c.id] = 0; }); if (S.persona !== 'blank') S.budget[m].foodWeek = 60; });
    if (S.persona !== 'blank') { const f = S.cats.find((c) => c.id === 'food'); if (f && f.name === 'Food and fun') f.name = 'Food'; }
    S.poolSpend = true; save();
    setTimeout(() => toast('$60 a week now covers all your spending'), 800);
  }
  // One time: add types for weekly spending money so purchases can be split by what they were.
  function addSpendTypes() {
    if (S.spendTypes) return;
    const at = S.cats.findIndex((c) => c.id === 'amazon'), add = [];
    if (!S.cats.some((c) => c.id === 'fun')) add.push({ id: 'fun', name: 'Fun and going out', kind: 'flex' });
    if (!S.cats.some((c) => c.id === 'shop')) add.push({ id: 'shop', name: 'Shopping', kind: 'flex' });
    S.cats.splice(at < 0 ? S.cats.length : at, 0, ...add);
    S.spendTypes = true; save();
  }
  // One time: Mom payback becomes a strict $150 monthly bill, and savings come from what is left over.
  function momStrict() {
    if (S.persona === 'blank' || S.momStrict) return;
    if (!S.cats.some((c) => c.id === 'mompay')) { const at = S.cats.findIndex((c) => c.id === 'subs'); S.cats.splice(at < 0 ? 0 : at, 0, { id: 'mompay', name: 'Mom payback', kind: 'fixed' }); }
    ['school', 'summer'].forEach((m) => { const b = S.budget[m]; b.amounts.mompay = 150; b.savings.mom = 0; b.savings.gen = 0; });
    if (!S.bills.some((x) => x.cat === 'mompay')) S.bills.push({ id: 'bmom', name: 'Mom payback', amount: 150, day: null, cat: 'mompay' });
    LO().start = C.shiftMonthKey(C.monthKey(C.today()), 1);
    S.momStrict = true; save();
    setTimeout(() => toast('Mom payback is now a strict $150 a month'), 900);
  }
  // One time: overspending in a week now comes out of the next week, starting this week.
  function overCarryOn() {
    if (S.overCarryInit && (!S.overCarry || S.overSince)) return;
    const first = !S.overCarryInit;
    if (!S.overCarryInit) { S.overCarry = true; S.overCarryInit = true; }
    if (S.overCarry && !S.overSince) S.overSince = C.weekStart(C.today());
    save();
    if (first && S.expenses.length) setTimeout(() => toast('Overspending now comes out of next week'), 1000);
  }
  async function lock() {
    await flush(); V.lock(); S = null; closeSheet(); showLock();
  }
  document.addEventListener('visibilitychange', async () => {
    document.body.classList.toggle('hidden', document.hidden);
    if (document.hidden) { hiddenAt = Date.now(); await flush(); }
    else if (S && hiddenAt && Date.now() - hiddenAt > MIN5 && !V.isAuto()) lock();
  });
  window.addEventListener('pagehide', () => { hiddenAt = hiddenAt || Date.now(); flush(); });

  // ---------- display size (per device, not encrypted so it applies on the lock screen too) ----------
  function pinHintOn() { try { return localStorage.getItem('moneypin') === '1'; } catch (e) { return false; } }
  function getPinHint() { return pinHintOn(); }
  function setPinHint(v) { try { if (v) localStorage.setItem('moneypin', '1'); else localStorage.removeItem('moneypin'); } catch (e) {} }
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.name === 'p' && el.dataset && el.dataset.auto === '1') {
      el.value = el.value.replace(/\D/g, '');
      if (el.value.length === 6 && el.form) el.form.requestSubmit();
    }
  });
  function getScale() { try { const v = parseFloat(localStorage.getItem('moneyui')); return v >= 0.7 && v <= 1.3 ? v : 1; } catch (e) { return 1; } }
  function applyScale(v) { const h = document.documentElement; h.style.zoom = v === 1 ? '' : String(v); h.style.setProperty('--z', String(v)); }
  function setScale(v) { try { localStorage.setItem('moneyui', String(v)); } catch (e) {} applyScale(v); }
  document.addEventListener('input', (ev) => {
    if (ev.target.id !== 'uiscale') return;
    const v = Number(ev.target.value) / 100; setScale(v);
    const o = $('#uiscaleval'); if (o) o.textContent = Math.round(v * 100) + '%';
  });
  actions.resetScale = () => { setScale(1); const r = $('#uiscale'); if (r) r.value = 100; const o = $('#uiscaleval'); if (o) o.textContent = '100%'; };
  const THEMES = [['auto', 'Auto', '#5b9bff'], ['midnight', 'Midnight', '#5b9bff'], ['black', 'Black', '#111'], ['light', 'Light', '#2563eb'], ['paper', 'Paper', '#b45309'], ['mint', 'Mint', '#059669'], ['forest', 'Forest', '#34d399'], ['ocean', 'Ocean', '#22d3ee'], ['grape', 'Grape', '#a78bfa'], ['rose', 'Rose', '#fb7185'], ['sunset', 'Sunset', '#fb923c']];
  const BARS = { midnight: '#0a1120', black: '#000000', light: '#eef2fa', paper: '#f6f1e7', mint: '#eaf7f1', forest: '#07140e', ocean: '#06141a', grape: '#120b1f', rose: '#1a0b12', sunset: '#1a0f08' };
  function getTheme() { try { const t = localStorage.getItem('moneytheme'); return THEMES.some((x) => x[0] === t) ? t : 'auto'; } catch (e) { return 'auto'; } }
  function applyTheme(t) {
    const h = document.documentElement;
    if (t === 'auto') h.removeAttribute('data-theme'); else h.setAttribute('data-theme', t);
    const light = ['light', 'paper', 'mint'].includes(t);
    const cs = document.querySelector('meta[name=color-scheme]'); if (cs) cs.setAttribute('content', t === 'auto' ? 'dark light' : light ? 'light' : 'dark');
    const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', BARS[t] || (matchMedia('(prefers-color-scheme: light)').matches ? '#eef2fa' : '#0a1120'));
  }
  // Checks GitHub for a newer version. Only reloads when there really is one, then reopens Settings after unlock.
  let updating = false;
  actions.updateApp = async (d, el) => {
    if (updating) return;
    updating = true;
    const btn = el && el.closest ? el.closest('button') : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Checking'; }
    const done = (msg) => { updating = false; if (btn) { btn.disabled = false; btn.textContent = 'Check for updates'; } if (msg) toast(msg); };
    try {
      await flush();
      if (!('serviceWorker' in navigator)) return done('Updates need Safari on iPhone');
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) reg = await navigator.serviceWorker.register('sw.js');
      await reg.update();
      const nw = reg.installing || reg.waiting;
      if (!nw) return done('You have the newest version');
      if (btn) btn.textContent = 'Downloading';
      await new Promise((res) => {
        const t = setTimeout(res, 15000);
        const ok = () => { if (nw.state === 'activated' || nw.state === 'redundant') { clearTimeout(t); res(); } };
        nw.addEventListener('statechange', ok); ok();
      });
      try { sessionStorage.setItem('moneyUpdated', JSON.stringify({ tab: ui.tab, more: ui.more })); } catch (e) {}
      location.reload();
    } catch (e) { done('Could not check right now. Try again with internet.'); }
  };
  actions.setTheme = (d) => { try { localStorage.setItem('moneytheme', d.v); } catch (e) {} applyTheme(d.v); render(); };
  applyTheme(getTheme());
  applyScale(getScale());

  // ---------- boot ----------
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  showLock();
})();
