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
    const amounts = { gas: 150, insurance: 200, flexpay: 53.66, dad: 136.82, phone: 54, gym: 25, haircut: 42, subs: 41.99, food: 260, amazon: 80, other: 0 };
    return {
      v: 1, persona: 'mahi', mode: 'school',
      cats: [
        { id: 'gas', name: 'Gas', kind: 'fixed' }, { id: 'insurance', name: 'Car insurance', kind: 'fixed' },
        { id: 'flexpay', name: 'Flex pay', kind: 'fixed' }, { id: 'dad', name: "Dad's payment", kind: 'fixed' },
        { id: 'phone', name: 'Phone', kind: 'fixed' }, { id: 'gym', name: 'Gym', kind: 'fixed' },
        { id: 'haircut', name: 'Haircut', kind: 'fixed' }, { id: 'subs', name: 'Subscriptions', kind: 'fixed' },
        { id: 'food', name: 'Food and fun', kind: 'flex' }, { id: 'amazon', name: 'Amazon essentials', kind: 'flex' },
        { id: 'other', name: 'Other', kind: 'flex' }
      ],
      budget: {
        school: { amounts: Object.assign({}, amounts), foodWeek: 65, income: 1300, savings: { mom: 150, gen: 106.53 } },
        summer: { amounts: Object.assign({}, amounts), foodWeek: 65, pay: 0, freq: 'biweekly', savings: { mom: 300, trip: 200, gen: 300 } }
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
      csvMap: null, lastBackup: null, lastAccount: 'chk', dismissed: {}
    };
  }

  function blankState() {
    const s = defaultState();
    s.persona = 'blank';
    s.cats = s.cats.filter((c) => c.id !== 'flexpay' && c.id !== 'dad');
    s.cats.find((c) => c.id === 'haircut').name = 'Personal care';
    s.cats.find((c) => c.id === 'amazon').name = 'Shopping';
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
  const plannedSpend = () => sum(S.cats.filter((c) => c.id !== 'other'), (c) => budgetOf().amounts[c.id] || 0);
  const plannedSavings = () => sum(Object.values(budgetOf().savings));
  function monthSpend(mk) {
    const m = {};
    S.expenses.forEach((e) => { if (counted(e) && C.monthKey(e.date) === mk) m[e.cat] = (m[e.cat] || 0) + e.amount; });
    return m;
  }
  function weekSpend(ws, cat) {
    const we = C.addDays(ws, 6);
    return sum(S.expenses.filter((e) => counted(e) && e.cat === (cat || 'food') && e.date >= ws && e.date <= we), (e) => e.amount);
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

  // ---------- small UI parts ----------
  const bar = (pct, cls) => `<div class="bar"><div class="fill ${cls}" data-w="${Math.max(0, Math.min(100, pct * 100)).toFixed(1)}"></div></div>`;
  function ring(pct, cls, big, small) {
    const r = 90, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct));
    return `<div class="ringwrap"><svg class="ringsvg" viewBox="0 0 210 210"><circle class="rtrack" cx="105" cy="105" r="${r}"/><circle class="rfill ${cls}" cx="105" cy="105" r="${r}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 105 105)"/></svg><div class="ringtext"><div class="big">${big}</div><div class="muted small">${small}</div></div></div>`;
  }
  const card = (label, inner, cls) => `<div class="card ${cls || ''}">${label ? `<p class="label">${label}</p>` : ''}${inner}</div>`;
  const monthNav = (mk, act) => `<div class="row" style="margin-bottom:14px"><button class="btn small" data-act="${act}" data-d="-1">Previous</button><div class="med" style="margin:0">${C.monthName(mk)}</div><button class="btn small" data-act="${act}" data-d="1">Next</button></div>`;
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
    const tabs = [['home', 'Home', ICON.home], ['budget', 'Budget', ICON.chart], ['ious', 'IOUs', ICON.people], ['goals', 'Goals', ICON.target], ['more', 'More', ICON.more]];
    $('#app').innerHTML = `<div class="screen">${body}</div>` +
      ((ui.tab === 'home' || ui.tab === 'budget') && !ui.more ? '<button class="fab" data-act="add">+ Add</button>' : '') +
      `<nav class="tabbar">${tabs.map((t) => `<button class="${ui.tab === t[0] ? 'on' : ''}" data-act="tab" data-t="${t[0]}">${t[2]}<span>${t[1]}</span></button>`).join('')}</nav>`;
    applyWidths();
    window.scrollTo(0, y);
  }
  function applyWidths() { document.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; }); }

  // ---------- HOME ----------
  function Home() {
    const t = C.today(), mk = C.monthKey(t), b = budgetOf();
    let h = `<div class="head"><h1 class="title">Home</h1><button class="icon-btn" data-act="settings" aria-label="Settings">${ICON.gear}</button></div><div class="sub">${C.longDate(t)}</div>`;
    h += `<div class="seg"><button class="${S.mode === 'school' ? 'on' : ''}" data-act="mode" data-m="school">School year</button><button class="${S.mode === 'summer' ? 'on' : ''}" data-act="mode" data-m="summer">Summer</button></div>`;

    if (new Date().getDay() === 0 && !S.dismissed['sun' + t]) {
      const open = S.ious.filter((i) => !i.settled).length;
      h += card('Sunday review', `<p class="med">Review the week and settle up</p><p class="muted">${open ? open + ' open IOU' + (open === 1 ? '' : 's') + ' to look at.' : 'No open IOUs.'}</p><div class="btns"><button class="btn" data-act="sundayWeek">Last week</button><button class="btn" data-act="sundayIous">IOUs</button></div><button class="btn" style="margin-top:10px" data-act="dismissSun">Dismiss</button>`, 'note');
    }
    const lb = S.lastBackup;
    if (S.expenses.length && (!lb || C.daysBetween(lb, t) >= 7)) {
      h += card('Backup', `<p>${lb ? 'It has been ' + C.daysBetween(lb, t) + ' days since your last backup.' : 'You have not backed up yet.'}</p><button class="btn" style="margin-top:10px" data-act="exportBackup">Back up now</button>`);
    }
    if (cardsOwed() > checking() && cardsOwed() > 0) {
      h += card('Card warning', `<p class="med r">Cards owe ${fm(cardsOwed())}</p><p>Checking has ${fm(checking())}. You are short ${fm(cardsOwed() - checking())} before autopay.</p>`, 'warn');
    }

    const ws = C.weekStart(t), fw = b.foodWeek, sp = weekSpend(ws), left = fw - sp;
    h += card('Left to spend this week', `<p class="big ${left < 0 ? 'r' : 'g'}">${fm(left)} ${left < 0 ? 'over' : 'left'}</p><p class="muted">${fm(sp)} of ${fm(fw)} on food and fun. ${daysToSunday()} days until Sunday.</p>${bar(fw ? sp / fw : 0, C.status(fw ? sp / fw : 0))}`);

    const ms = monthSpend(mk), spent = sum(Object.values(ms)), plan = plannedSpend();
    const over = S.cats.filter((c) => (b.amounts[c.id] || 0) > 0 && (ms[c.id] || 0) > b.amounts[c.id]).length;
    h += card('Month status', `<p class="big">${fm(spent)} <span class="muted med">of ${fm(plan)}</span></p>${bar(plan ? spent / plan : 0, C.status(plan ? spent / plan : 0))}<p class="muted">${over ? over + ' categor' + (over === 1 ? 'y is' : 'ies are') + ' over budget.' : 'Nothing is over budget.'}</p>`);

    const saved = savedInMonth(mk), sp2 = plannedSavings();
    h += card('Savings this month', `<p class="big g">${fm(saved)} <span class="muted med">of ${fm(sp2)}</span></p>${bar(sp2 ? saved / sp2 : 0, 'b')}<p class="muted small">Bonus this month: ${fm(bonusInMonth(mk))}. Bonus money goes straight to savings and is never income.</p><button class="btn" style="margin-top:8px" data-act="logBonus">Log bonus</button>`);

    const owed = S.ious.filter((i) => !i.settled && i.dir === 'owedToMe');
    const od = owed.filter((i) => C.daysBetween(i.date, t) > 14).length;
    h += card('Owed to me', `<p class="big">${fm(sum(owed, remaining))}</p><p class="${od ? 'r' : 'muted'}">${od ? od + ' unpaid for over 14 days' : owed.length + ' open'}</p>`);

    const nb = nextBill();
    h += card('Next bill due', nb ? `<p class="med ${nb.overdue ? 'r' : ''}">${esc(nb.b.name)}, ${fm(nb.b.amount)}</p><p class="muted">${nb.overdue ? 'Overdue since ' : 'Due '}${C.shortDate(nb.date)}</p>` : '<p class="muted">Set due days in Recurring bills to see this.</p><button class="btn" style="margin-top:10px" data-act="openMore" data-v="bills">Recurring bills</button>');

    const st = takeoutStreak();
    h += card('Takeout streak', `<p class="big">${st.days} day${st.days === 1 ? '' : 's'}</p><p class="muted">${st.has ? 'Since your last food and fun purchase.' : 'No food and fun logged yet.'}</p>`);

    h += `<div class="btns"><button class="btn" data-act="openMore" data-v="afford">Can I afford this?</button><button class="btn" data-act="openMore" data-v="recap">Monthly recap</button></div>`;
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
    const sp = weekSpend(ws), fw = b.foodWeek, left = fw - sp, pct = fw ? sp / fw : 0;
    let h = `<div class="row" style="margin-bottom:14px"><button class="btn small" data-act="wnav" data-d="-1">Previous</button><div class="muted" style="text-align:center">${C.shortDate(ws)} to ${C.shortDate(we)}</div><button class="btn small" data-act="wnav" data-d="1">Next</button></div>`;
    const sub = ui.wOff === 0 ? `${daysToSunday()} days until Sunday` : (left < 0 ? 'over' : 'left');
    h += card('Food and fun', ring(pct, C.status(pct), fm(left), left < 0 ? 'over budget' : 'left') +
      `<p style="text-align:center" class="muted">${fm(sp)} spent of ${fm(fw)}. ${sub}.</p>` +
      (ui.wOff === 0 && left > 0 ? `<p style="text-align:center" class="muted small">About ${fm(left / daysToSunday())} a day to stay on track.</p>` : ''));
    const list = S.expenses.filter((e) => counted(e) && e.cat === 'food' && e.date >= ws && e.date <= we).sort((a, c) => (a.date < c.date ? 1 : -1));
    h += card('This week', list.length ? list.map(expRow).join('') : '<p class="muted">Nothing logged yet.</p>');
    return h;
  }
  function MonthView() {
    const mk = ui.mk || C.monthKey(C.today()), b = budgetOf(), ms = monthSpend(mk);
    let h = monthNav(mk, 'mnav');
    const rows = S.cats.filter((c) => (b.amounts[c.id] || 0) > 0 || (ms[c.id] || 0) > 0).map((c) => {
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
    const tags = (e.paidFromSavings ? '<span class="pill">Savings</span>' : '') + (e.household ? '<span class="pill">Household</span>' : '') + (e.forOther ? `<span class="pill y">For ${esc(e.forOther)}</span>` : '');
    return `<div class="item" data-act="editExp" data-id="${e.id}" style="cursor:pointer"><div class="row"><span class="t">${esc(e.note || catName(e.cat))}${tags}</span><b>${fm(e.amount)}</b></div><div class="muted small">${C.shortDate(e.date)}, ${esc(catName(e.cat))}</div></div>`;
  }
  function HistView() {
    const list = S.expenses.slice().sort((a, c) => (a.date < c.date ? 1 : a.date > c.date ? -1 : 0));
    if (!list.length) return card('History', '<p class="muted">No expenses yet. Tap Add to log your first one.</p>');
    let h = card('History', list.slice(0, ui.hist).map(expRow).join(''));
    if (list.length > ui.hist) h += `<button class="btn" data-act="moreHist">Show more</button>`;
    return h;
  }

  // ---------- IOUs ----------
  function IOUs() {
    const t = C.today();
    let h = `<div class="head"><h1 class="title">IOUs</h1></div><div class="sub">Who owes what</div>`;
    h += `<button class="btn primary" style="margin-bottom:16px" data-act="addIou">Add an IOU</button>`;
    const open = S.ious.filter((i) => !i.settled);
    const net = {};
    open.forEach((i) => { const k = i.person.trim().toLowerCase(); net[k] = net[k] || { name: i.person.trim(), v: 0 }; net[k].v += i.dir === 'owedToMe' ? remaining(i) : -remaining(i); });
    const people = Object.values(net);
    if (people.length) h += card('Net balance by person', people.map((p) => `<div class="row item"><span class="t">${esc(p.name)}</span><span class="${p.v > 0.004 ? 'g' : p.v < -0.004 ? 'r' : 'muted'}">${Math.abs(p.v) < 0.005 ? 'Even' : p.v > 0 ? 'Owes you ' + fm(p.v) : 'You owe ' + fm(p.v)}</span></div>`).join(''));
    const list = (dir, title) => {
      const items = open.filter((i) => i.dir === dir).sort((a, c) => (a.date < c.date ? -1 : 1));
      return card(title, items.length ? items.map((i) => {
        const age = C.daysBetween(i.date, t), late = age > 14;
        return `<div class="item"><div class="row"><span class="t ${late ? 'r' : ''}">${esc(i.person)}</span><b class="${late ? 'r' : ''}">${fm(remaining(i))}</b></div><div class="muted small">${esc(i.reason || 'No reason')}, ${C.shortDate(i.date)}${late ? `<span class="pill r">${age} days unpaid</span>` : ''}${i.payments.length ? `<span class="pill g">Paid ${fm(sum(i.payments, (p) => p.amount))} of ${fm(i.amount)}</span>` : ''}</div><div class="btns"><button class="btn small" data-act="payIou" data-id="${i.id}">Partial payment</button><button class="btn small" data-act="settleIou" data-id="${i.id}">Settle</button><button class="btn small danger" data-act="delIou" data-id="${i.id}">Delete</button></div></div>`;
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
    h += `<button class="btn primary" style="margin-bottom:16px" data-act="logBonus">Log bonus</button>`;
    // mom
    const mom = S.goals.mom, momTot = goalTotal('mom'), momLeft = Math.max(0, mom.target - momTot), momMonthly = b.savings.mom || 0;
    h += goalCard('mom', mom.target ? `<p class="big">${fm(momLeft)} <span class="muted med">left of ${fm(mom.target)}</span></p>${bar(mom.target ? momTot / mom.target : 0, 'g')}<p class="muted">${momLeft === 0 ? 'Paid off.' : momMonthly ? Math.ceil(momLeft / momMonthly) + ' months left at ' + fm(momMonthly) + ' a month.' : 'Set a monthly amount in Budget and income.'}</p>` : `<p class="muted">Enter the total you owe to see months left at ${fm(momMonthly)} a month.</p><p>Paid back so far: <b>${fm(momTot)}</b></p>`);
    // insurance
    const ins = S.goals.ins, insTot = goalTotal('ins');
    let insLine = '<p class="muted">Set the due date to see what you need each month.</p>';
    if (ins.due) {
      const dd = C.daysBetween(t, ins.due), need = Math.max(0, ins.target - insTot);
      if (dd < 0) insLine = `<p class="r">Due date was ${C.shortDate(ins.due)}.</p>`;
      else { const months = Math.max(1, dd / 30.44); insLine = `<p class="muted">Due ${C.shortDate(ins.due)}, ${dd} days away. ${need > 0 ? 'Needs about ' + fm(need / months) + ' a month.' : 'Fully funded.'}</p>`; }
    }
    h += goalCard('ins', `<p class="big">${fm(insTot)} <span class="muted med">of ${fm(ins.target)}</span></p>${bar(ins.target ? insTot / ins.target : 0, C.status(0.5))}${insLine}<p class="muted small">Car insurance spending counts toward this.</p>${ins.due ? '<button class="btn" style="margin-top:8px" data-act="insNext">Bill paid, start next cycle</button>' : ''}`);
    // trip
    const trip = S.goals.trip, tripTot = goalTotal('trip');
    h += goalCard('trip', trip.target ? `<p class="big">${fm(tripTot)} <span class="muted med">of ${fm(trip.target)}</span></p>${bar(tripTot / trip.target, 'b')}` : `<p class="big">${fm(tripTot)}</p><p class="muted">Set a target in Edit if you want a progress bar.</p>`);
    // general
    h += goalCard('gen', `<p class="big">${fm(goalTotal('gen'))}</p><p class="muted small">After one time purchases paid from savings.</p>`);
    return h;
  }
  function goalCard(k, inner) {
    return card(S.goals[k].name, inner + `<div class="btns"><button class="btn small" data-act="contrib" data-k="${k}">Log contribution</button><button class="btn small" data-act="goalHist" data-k="${k}">History</button><button class="btn small" data-act="goalEdit" data-k="${k}">Edit</button></div>`);
  }

  // ---------- MORE ----------
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
    const rows = [['bills', 'Recurring bills'], ['household', mahi() ? "Dad's household bills" : 'Household bills'], ['cards', 'Cards and balances'], ['import', 'Import transactions'], ['afford', 'Can I afford this?'], ['recap', 'Monthly recap'], ['budgetEdit', 'Budget and income'], ['rules', 'Category rules'], ['security', 'Theme, text size, security and backup'], ['bank', 'Automatic bank connection']];
    return `<div class="head"><h1 class="title">More</h1></div><div class="sub">Tools and settings</div>` + card('', `<div class="menu">${rows.map((r) => `<button class="mrow" data-act="openMore" data-v="${r[0]}"><span>${r[1]}</span><span class="chev">&rsaquo;</span></button>`).join('')}</div>`);
  }

  function BillsView() {
    const mk = ui.bmk || C.monthKey(C.today()), t = C.today();
    let h = back() + `<h1 class="title">Recurring bills</h1><div class="sub">Check a bill to count it as spent</div>` + monthNav(mk, 'bnav');
    h += card('Bills', S.bills.map((b) => {
      const paid = billPaid(b, mk), due = b.day ? dueDate(mk, b.day) : null, late = !paid && due && due < t;
      return `<div class="item row"><label class="check" style="flex:1"><input type="checkbox" data-act="billPaid" data-id="${b.id}" ${paid ? 'checked' : ''}><span><span class="t ${late ? 'r' : ''}">${esc(b.name)}</span><br><span class="muted small">${fm(b.amount)}, ${due ? 'due ' + C.shortDate(due) : 'no due day set'}</span></span></label><button class="btn small" data-act="editBill" data-id="${b.id}">Edit</button></div>`;
    }).join('') || '<p class="muted">No bills yet.</p>');
    h += `<button class="btn primary" data-act="addBill">Add a bill</button>`;
    return h;
  }

  function HouseholdView() {
    const items = S.household.items, total = sum(items, (i) => i.amount), t = C.monthKey(C.today());
    let h = back() + `<h1 class="title">${mahi() ? "Dad's bills" : 'Household bills'}</h1><div class="sub">Pass through only. Tag any charge as Household when you add it.</div>`;
    h += card('Monthly bills', items.map((it, i) => `<div class="item"><div class="two row" style="gap:8px"><input type="text" data-path="household.items.${i}.name" data-t="s" value="${esc(it.name)}"><input type="text" inputmode="decimal" data-path="household.items.${i}.amount" data-t="n" data-re="1" value="${it.amount}" style="max-width:120px"></div><button class="btn small danger" style="margin-top:8px" data-act="delHh" data-i="${i}">Remove</button></div>`).join('') + `<div class="row" style="margin-top:12px"><b>Total</b><b>${fm(total)}</b></div><button class="btn" style="margin-top:10px" data-act="addHh">Add a bill</button>`);
    const months = [0, 1, 2, 3, 4, 5].map((n) => C.shiftMonthKey(t, -n));
    h += card(mahi() ? "Dad's deposit by month" : 'Deposit received by month', months.map((mk) => {
      const dep = S.household.deposits[mk];
      let st = '<span class="pill">No deposit logged</span>';
      if (dep > 0) st = dep + 0.004 >= total ? '<span class="pill g">Covered</span>' : `<span class="pill r">Short ${fm(total - dep)}</span>`;
      return `<div class="item"><div class="row"><span class="t">${C.monthName(mk)}</span>${st}</div><input type="text" inputmode="decimal" placeholder="Deposit amount" data-path="household.deposits.${mk}" data-t="n" data-re="1" value="${dep || ''}" style="margin-top:8px"></div>`;
    }).join(''));
    return h;
  }

  function CardsView() {
    let h = back() + `<h1 class="title">Cards and balances</h1><div class="sub">Nickname and last 4 digits only</div>`;
    const owed = cardsOwed(), chk = checking();
    if (owed > chk && owed > 0) h += card('Warning', `<p class="med r">Cards owe ${fm(owed)}</p><p>Checking has ${fm(chk)}. You are short ${fm(owed - chk)} before autopay.</p>`, 'warn');
    else if (owed > 0) h += card('Autopay check', `<p class="med g">Checking covers your cards</p><p class="muted">${fm(chk - owed)} to spare after ${fm(owed)} in card balances.</p>`);
    h += card('Balances', S.accounts.map((a, i) => `<div class="item"><div class="row"><span class="t">${esc(a.name)}${a.last4 ? ' ending ' + esc(a.last4) : ''}<span class="pill">${a.type === 'card' ? 'Card' : 'Checking'}</span></span><button class="btn small" data-act="editAcct" data-id="${a.id}">Edit</button></div><input type="text" inputmode="decimal" placeholder="Balance" data-path="accounts.${i}.balance" data-t="n" data-re="1" value="${a.balance || ''}" style="margin-top:8px"></div>`).join(''));
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
    if (m === 'school') h += card('Income', `<label class="f">Monthly paycheck income</label><input type="text" inputmode="decimal" data-path="budget.school.income" data-t="n" data-re="1" value="${b.income}"><p class="muted small">Bonus money like tips is logged separately and never counted as income.</p>`);
    else h += card(mahi() ? 'Toyota co op pay' : 'Summer job pay', `<label class="f">Pay per check</label><input type="text" inputmode="decimal" data-path="budget.summer.pay" data-t="n" data-re="1" value="${b.pay || ''}"><label class="f">How often</label><select data-path="budget.summer.freq" data-t="s" data-re="1">${[['weekly', 'Weekly'], ['biweekly', 'Every two weeks'], ['semimonthly', 'Twice a month'], ['monthly', 'Monthly']].map((o) => `<option value="${o[0]}" ${b.freq === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select><p class="muted">About ${fm(incomeOf('summer'))} a month.</p>`);
    h += card('Monthly spending budget', S.cats.filter((c) => c.id !== 'other').map((c) => `<label class="f">${esc(c.name)}</label><input type="text" inputmode="decimal" data-path="budget.${m}.amounts.${c.id}" data-t="n" data-re="1" value="${b.amounts[c.id]}">`).join('') + `<label class="f">Food and fun per week</label><input type="text" inputmode="decimal" data-path="budget.${m}.foodWeek" data-t="n" data-re="1" value="${b.foodWeek}">`);
    const labels = { mom: mahi() ? 'Paying back Mom' : 'Payback goal', gen: 'General savings', trip: 'Trip fund' };
    h += card('Monthly savings targets', Object.keys(b.savings).map((k) => `<label class="f">${labels[k] || k}</label><input type="text" inputmode="decimal" data-path="budget.${m}.savings.${k}" data-t="n" data-re="1" value="${b.savings[k]}">`).join(''));
    const inc = incomeOf(m), sp = plannedSpend(), sv = plannedSavings(), left = C.round2(inc - sp - sv);
    h += card('Plan check', `<div class="row"><span>Income</span><b>${fm(inc)}</b></div><div class="row"><span>Spending</span><b>${fm(sp)}</b></div><div class="row"><span>Savings</span><b>${fm(sv)}</b></div><div class="row"><span>${left < 0 ? 'Over plan by' : 'Unassigned'}</span><b class="${left < 0 ? 'r' : left === 0 ? 'g' : ''}">${fm(left)}</b></div>`);
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
    if (cat === 'food') { const l = b.foodWeek - weekSpend(ws); out += line('This week, food and fun', l, l - price); }
    const cl = (b.amounts[cat] || 0) - (ms[cat] || 0);
    out += line('This month, ' + esc(catName(cat)), cl, cl - price);
    const tl = plannedSpend() - sum(Object.values(ms));
    out += line('This month, whole budget', tl, tl - price);
    const verdict = (cl - price < 0 || tl - price < 0) ? '<p class="med r">That puts you over budget.</p>' : (cl - price < price ? '<p class="med y">It fits, but it gets tight.</p>' : '<p class="med g">It fits comfortably.</p>');
    return card('Impact', verdict + out);
  }

  function RecapView() {
    const mk = ui.rmk || C.monthKey(C.today()), b = budgetOf();
    const list = S.expenses.filter((e) => counted(e) && C.monthKey(e.date) === mk);
    const tot = sum(list, (e) => e.amount);
    const groups = {};
    list.forEach((e) => { const k = (e.note || catName(e.cat)).trim().toLowerCase(); groups[k] = groups[k] || { n: e.note || catName(e.cat), v: 0, c: 0 }; groups[k].v += e.amount; groups[k].c++; });
    const top = Object.values(groups).sort((a, c) => c.v - a.v).slice(0, 5);
    const takeouts = list.filter((e) => e.takeout || e.cat === 'food');
    const amz = list.filter((e) => e.cat === 'amazon').length;
    const saved = savedInMonth(mk), plan = plannedSavings();
    let h = back() + `<h1 class="title">Monthly recap</h1>` + monthNav(mk, 'rnav');
    h += card('Total spent', `<p class="big">${fm(tot)}</p><p class="muted">Budget was ${fm(plannedSpend())}.</p>`);
    h += card('Top merchants', top.length ? top.map((g) => `<div class="row item"><span>${esc(g.n)} <span class="muted small">${g.c}x</span></span><b>${fm(g.v)}</b></div>`).join('') : '<p class="muted">Nothing logged this month.</p>');
    h += card('Takeout', `<p class="big">${fm(sum(takeouts, (e) => e.amount))}</p><p class="muted">${takeouts.length} purchase${takeouts.length === 1 ? '' : 's'} in food and fun.</p>`);
    h += card(esc(catName('amazon')) + ' orders', `<p class="big">${amz}</p>`);
    h += card('Saved vs plan', `<p class="big ${saved >= plan ? 'g' : ''}">${fm(saved)} <span class="muted med">of ${fm(plan)}</span></p>${bar(plan ? saved / plan : 0, saved >= plan ? 'g' : 'y')}<p class="muted">${saved >= plan ? 'You hit your savings plan.' : fm(plan - saved) + ' short of plan.'}</p>`);
    return h;
  }

  function SecurityView() {
    return back() + `<h1 class="title">Security and backup</h1><div class="sub">Your data never leaves this device</div>` +
      card('Theme', `<div class="chips">${THEMES.map((t) => `<label class="${getTheme() === t[0] ? 'on' : ''}"><button type="button" class="tbtn" data-act="setTheme" data-v="${t[0]}"><span class="dot d-${t[0]}"></span>${t[1]}</button></label>`).join('')}</div>`) +
      card('App updates', `<p class="muted small">Pulls the newest version from GitHub. Your data is not touched.</p><button class="btn" data-act="updateApp">Check for updates</button>`) +
      card('Text size', `<input type="range" id="uiscale" class="slider" min="70" max="130" step="5" value="${Math.round(getScale() * 100)}"><div class="row muted small"><span>Smaller</span><span id="uiscaleval">${Math.round(getScale() * 100)}%</span><span>Larger</span></div><button class="btn small mt" data-act="resetScale">Reset to 100%</button>`) +
      card('Lock', `<p class="muted">Locks after 5 minutes in the background.</p><div class="btns"><button class="btn" data-act="lockNow">Lock now</button><button class="btn" data-act="changePass">Change passcode</button></div><div id="facebox"></div>`) +
      card('Backup', `<p class="muted">Saves an encrypted file. Keep it in iCloud Drive in case Safari clears storage. ${S.lastBackup ? 'Last backup ' + C.shortDate(S.lastBackup) + '.' : 'No backup yet.'}</p><div class="btns"><button class="btn" data-act="exportBackup">Export backup</button><button class="btn" data-act="pickBackup">Restore backup</button></div><input type="file" id="bkfile" accept=".json,application/json" hidden>`) +
      card('Privacy', '<p class="muted">Everything is stored encrypted on this device. No server, no analytics. This app never asks for bank logins, full card numbers, or account numbers.</p>') +
      card('Danger zone', '<button class="btn" data-act="blankNow">I\'m not Mahi, clear his budget</button><p class="muted small">Keeps your passcode and logged expenses. Replaces the preloaded budget, bills, goals, and rules with blank ones.</p><button class="btn danger" style="margin-top:10px" data-act="erase">Erase all data</button>');
  }
  async function fillFaceBox() {
    const box = $('#facebox'); if (!box) return;
    if (!(await V.faceSupported())) { box.innerHTML = ''; return; }
    const on = await V.faceEnabled();
    box.innerHTML = `<button class="btn" style="margin-top:10px" data-act="${on ? 'faceOff' : 'faceOn'}">${on ? 'Turn off Face ID' : 'Turn on Face ID'}</button>`;
  }

  function BankView() {
    return back() + `<h1 class="title">Bank connection</h1><div class="sub">Not available yet</div>` + card('Why it is not here', '<p>Connecting a bank automatically would need a secure backend server and a service like Plaid to hold access tokens safely. This app has no server on purpose, so your data stays on your phone.</p><p class="muted">When you are ready, a small private backend can be added later. Until then, use manual entry, CSV import, or screenshot import.</p><button class="btn" disabled style="opacity:.5">Connect a bank</button>');
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

  function addSheet(id) {
    const e = id ? S.expenses.find((x) => x.id === id) : null;
    const cat = e ? e.cat : ui.lastCat, acct = e ? e.account : S.lastAccount;
    openSheet(`<h2>${e ? 'Edit expense' : 'Add expense'}</h2><form data-form="expense"><input type="hidden" name="id" value="${id || ''}">
      <input class="amount" name="amount" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off" value="${e ? e.amount.toFixed(2) : ''}" required>
      <label class="f">Category</label><div class="chips">${S.cats.map((c) => `<input type="radio" id="c_${c.id}" name="cat" value="${c.id}" ${c.id === cat ? 'checked' : ''}><label for="c_${c.id}">${esc(c.name)}</label>`).join('')}</div>
      <label class="f">Note</label><input type="text" name="note" autocomplete="off" placeholder="Optional" value="${esc(e ? e.note : '')}">
      <label class="f">Card or account</label><select name="account">${S.accounts.map((a) => `<option value="${a.id}" ${a.id === acct ? 'selected' : ''}>${esc(a.name)}${a.last4 ? ' ' + esc(a.last4) : ''}</option>`).join('')}<option value="cash" ${acct === 'cash' ? 'selected' : ''}>Cash or other</option></select>
      <label class="f">Date</label><input type="date" name="date" value="${e ? e.date : C.today()}">
      <label class="check" style="margin-top:10px"><input type="checkbox" name="forOther" data-toggle="personbox" ${e && e.forOther ? 'checked' : ''}>Bought for someone else</label>
      <div id="personbox" ${e && e.forOther ? '' : 'hidden'}><input type="text" name="person" placeholder="Who owes you?" autocomplete="off" value="${esc(e ? e.forOther : '')}"></div>
      <label class="check"><input type="checkbox" name="oneTime" ${e && e.paidFromSavings ? 'checked' : ''}>One time, paid from savings</label>
      <label class="check"><input type="checkbox" name="household" ${e && e.household ? 'checked' : ''}>Household charge, ignore it</label>
      <div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>
      ${e ? `<button class="btn danger" type="button" style="margin-top:10px" data-act="delExp" data-id="${e.id}">Delete expense</button>` : ''}</form>`);
    const a = $('#sheet input[name=amount]'); if (a && !e) setTimeout(() => a.focus(), 50);
  }

  // ---------- forms ----------
  const forms = {
    expense(fd) {
      const amount = C.round2(C.num(fd.get('amount')));
      if (!(amount > 0)) { toast('Enter an amount'); return; }
      const id = fd.get('id'), cat = fd.get('cat') || 'other';
      const forOther = !!fd.get('forOther'), person = (fd.get('person') || '').trim();
      if (forOther && !person) { toast('Who was it for?'); return; }
      const rec = { amount, cat, note: (fd.get('note') || '').trim(), account: fd.get('account'), date: fd.get('date') || C.today(), paidFromSavings: !!fd.get('oneTime'), household: !!fd.get('household'), forOther: forOther ? person : '', takeout: cat === 'food' && !fd.get('household') };
      let exp = id ? S.expenses.find((x) => x.id === id) : null, msg = 'Saved';
      if (exp) Object.assign(exp, rec); else { exp = Object.assign({ id: uid(), source: 'manual' }, rec); S.expenses.push(exp); }
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
    async setup(fd) {
      const p = fd.get('p') || '', p2 = fd.get('p2') || '', err = $('#lockerr');
      if (p.length < 6) { err.textContent = 'Use at least 6 characters'; return; }
      if (p !== p2) { err.textContent = 'Passcodes do not match'; return; }
      err.textContent = ''; $('#lockbtn').textContent = 'Creating'; $('#lockbtn').disabled = true;
      S = fd.get('persona') === 'blank' ? blankState() : defaultState();
      await V.create(p, S);
      startSession();
    },
    async unlock(fd) {
      const err = $('#lockerr'); err.textContent = ''; $('#lockbtn').disabled = true; $('#lockbtn').textContent = 'Checking';
      try { const st = await V.unlock(fd.get('p') || ''); S = Object.assign(defaultState(), st || {}); startSession(); }
      catch (e) { fails++; await new Promise((r) => setTimeout(r, Math.min(4000, fails * 600))); err.textContent = 'That passcode is not right'; $('#lockbtn').disabled = false; $('#lockbtn').textContent = 'Unlock'; }
    },
    async chpass(fd) {
      const n = fd.get('n') || '';
      if (n.length < 6) { toast('Use at least 6 characters'); return; }
      if (n !== fd.get('n2')) { toast('New passcodes do not match'); return; }
      try { await flush(); await V.changePass(fd.get('o') || '', n, S); closeSheet(); toast('Passcode changed. Face ID was turned off.'); fillFaceBox(); }
      catch (e) { toast(e.message); }
    },
    async faceon(fd) {
      try { await V.enableFace(fd.get('p') || ''); closeSheet(); toast('Face ID is on'); fillFaceBox(); }
      catch (e) { toast(e.message); }
    },
    async restore(fd) {
      try {
        S = Object.assign(defaultState(), await V.importBackup(ui.pendingBackup, fd.get('p') || ''));
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
    editExp(d) { addSheet(d.id); },
    delExp(d) {
      const e = S.expenses.find((x) => x.id === d.id); if (!e) return;
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
    rnav(d) { ui.rmk = C.shiftMonthKey(ui.rmk || C.monthKey(C.today()), +d.d); render(); },
    moreHist() { ui.hist += 40; render(); },
    sundayWeek() { ui.tab = 'budget'; ui.bview = 'week'; ui.wOff = -1; render(); },
    sundayIous() { ui.tab = 'ious'; render(); },
    dismissSun() { S.dismissed['sun' + C.today()] = true; save(); render(); },
    openMore(d) { ui.tab = 'more'; ui.more = d.v; ui.imp = null; render(); window.scrollTo(0, 0); if (d.v === 'security') fillFaceBox(); if (d.v === 'afford') setTimeout(() => { const p = $('input[name=price]'); if (p) p.focus(); }, 50); },
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
      const r = remaining(i); if (r > 0) i.payments.push({ date: C.today(), amount: r });
      i.settled = true; save(); render(); toast('Settled');
    },
    delIou(d) { if (confirm('Delete this IOU?')) { S.ious = S.ious.filter((x) => x.id !== d.id); save(); render(); } },
    // goals
    contrib(d) {
      openSheet(`<h2>Log contribution</h2><p class="muted">${esc(S.goals[d.k].name)}</p><form data-form="contrib"><input type="hidden" name="k" value="${d.k}"><label class="f">Amount</label><input class="amount" type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">Note</label><input type="text" name="note" autocomplete="off" placeholder="Optional"><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Log</button></div></form>`);
    },
    logBonus() {
      const gl = Object.keys(S.goals).map((k) => `<option value="${k}" ${k === (ui.bonusGoal || 'gen') ? 'selected' : ''}>${esc(S.goals[k].name)}</option>`).join('');
      openSheet(`<h2>Log bonus</h2><p class="muted">Tips, gifts, and money from family go straight to a savings goal. It is never counted as income.</p><form data-form="bonus"><label class="f">Amount</label><input class="amount" type="text" inputmode="decimal" name="amount" autocomplete="off" required><label class="f">From</label><div class="chips">${['Tips', 'Dad', 'Other'].map((x, i) => `<input type="radio" id="bs_${i}" name="src" value="${x}" ${i === 0 ? 'checked' : ''}><label for="bs_${i}">${x}</label>`).join('')}</div><label class="f">Send to goal</label><select name="k">${gl}</select><label class="f">Date</label><input type="date" name="date" value="${C.today()}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Log</button></div></form>`);
      const a = $('#sheet input[name=amount]'); if (a) setTimeout(() => a.focus(), 50);
    },
    goalHist(d) {
      const g = S.goals[d.k], list = g.contribs.slice().sort((a, c) => (a.date < c.date ? 1 : -1));
      openSheet(`<h2>${esc(g.name)}</h2>${list.length ? list.map((c) => `<div class="item row"><span>${C.shortDate(c.date)} ${esc(c.note)}<br><b>${fm(c.amount)}</b></span><button class="btn small danger" data-act="delContrib" data-k="${d.k}" data-id="${c.id}">Delete</button></div>`).join('') : '<p class="muted">No contributions yet.</p>'}<button class="btn" style="margin-top:14px" data-act="closeSheet">Close</button>`);
    },
    delContrib(d) { const g = S.goals[d.k]; g.contribs = g.contribs.filter((c) => c.id !== d.id); save(); closeSheet(); render(); },
    goalEdit(d) {
      const g = S.goals[d.k], label = d.k === 'mom' ? 'Total you owe' : 'Target';
      openSheet(`<h2>Edit ${esc(g.name)}</h2><form data-form="goaledit"><input type="hidden" name="k" value="${d.k}"><label class="f">${label}</label><input type="text" inputmode="decimal" name="target" value="${g.target || ''}" autocomplete="off">${d.k === 'ins' ? `<label class="f">Bill due date</label><input type="date" name="due" value="${g.due || ''}">` : ''}<div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`);
    },
    insNext() { const g = S.goals.ins; if (!g.due) return; g.start = g.due; g.due = C.addMonths(g.due, 6); save(); render(); toast('Next cycle started'); },
    // bills
    billPaid(d) {
      const mk = ui.bmk || C.monthKey(C.today()), b = S.bills.find((x) => x.id === d.id);
      if (billPaid(b, mk)) S.expenses = S.expenses.filter((e) => !(e.billId === b.id && C.monthKey(e.date) === mk));
      else S.expenses.push({ id: uid(), amount: b.amount, cat: b.cat, note: b.name, account: S.lastAccount, date: mk === C.monthKey(C.today()) ? C.today() : mk + '-01', paidFromSavings: false, forOther: '', takeout: false, billId: b.id, source: 'bill' });
      save(); render();
    },
    addBill() { billSheet(); },
    editBill(d) { billSheet(d.id); },
    delBill(d) { S.bills = S.bills.filter((b) => b.id !== d.id); save(); closeSheet(); render(); },
    // household
    addHh() { S.household.items.push({ id: uid(), name: 'New bill', amount: 0 }); save(); render(); },
    delHh(d) { S.household.items.splice(+d.i, 1); save(); render(); },
    // accounts
    addAcct() { acctSheet(); },
    editAcct(d) { acctSheet(d.id); },
    delAcct(d) { S.accounts = S.accounts.filter((a) => a.id !== d.id); save(); closeSheet(); render(); },
    delRule(d) { S.rules.splice(+d.i, 1); save(); render(); },
    // import
    pickCsv() { $('#csvfile').click(); },
    pickImg() { $('#imgfile').click(); },
    impCancel() { ui.imp = null; render(); },
    impSave() {
      const acct = $('#impacct').value, im = ui.imp; let n = 0;
      im.items.forEach((x) => {
        if (!x.on || !(x.amount > 0)) return;
        const hh = x.cat === '__hh';
        S.expenses.push({ id: uid(), amount: C.round2(x.amount), cat: hh ? 'other' : x.cat, note: x.desc, account: acct, date: x.date, paidFromSavings: false, household: hh, forOther: '', takeout: x.cat === 'food', source: im.kind });
        n++;
      });
      S.lastAccount = acct; ui.imp = null; save(); render(); toast(n + ' saved');
    },
    // security
    lockNow() { lock(); },
    changePass() {
      openSheet(`<h2>Change passcode</h2><form data-form="chpass"><label class="f">Current passcode</label><input type="password" name="o" autocomplete="current-password" required><label class="f">New passcode</label><input type="password" name="n" autocomplete="new-password" required><label class="f">Repeat new passcode</label><input type="password" name="n2" autocomplete="new-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Change</button></div></form>`);
    },
    faceOn() {
      openSheet(`<h2>Turn on Face ID</h2><p class="muted">Enter your passcode once to link it.</p><form data-form="faceon"><input type="password" name="p" autocomplete="current-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Continue</button></div></form>`);
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
      S = Object.assign(blankState(), { expenses: S.expenses, ious: S.ious, accounts: S.accounts, lastBackup: S.lastBackup });
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
    openSheet(`<h2>${b ? 'Edit bill' : 'Add a bill'}</h2><form data-form="bill"><input type="hidden" name="id" value="${id || ''}"><label class="f">Name</label><input type="text" name="name" value="${esc(b ? b.name : '')}" required><label class="f">Amount</label><input type="text" inputmode="decimal" name="amount" value="${b ? b.amount : ''}" required><label class="f">Due day of the month</label><input type="number" name="day" min="1" max="31" value="${b && b.day ? b.day : ''}" placeholder="1 to 31"><label class="f">Category</label><select name="cat">${S.cats.map((c) => `<option value="${c.id}" ${b && b.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>${b ? `<button class="btn danger" type="button" style="margin-top:10px" data-act="delBill" data-id="${b.id}">Delete bill</button>` : ''}</form>`);
  }
  function acctSheet(id) {
    const a = id ? S.accounts.find((x) => x.id === id) : null;
    openSheet(`<h2>${a ? 'Edit account' : 'Add a card or account'}</h2><p class="muted">Nickname and last 4 digits only. Never enter full numbers.</p><form data-form="acct"><input type="hidden" name="id" value="${id || ''}"><label class="f">Nickname</label><input type="text" name="name" value="${esc(a ? a.name : '')}" required><label class="f">Last 4 digits</label><input type="text" name="last4" inputmode="numeric" maxlength="4" value="${esc(a ? a.last4 : '')}"><label class="f">Type</label><select name="type"><option value="card" ${a && a.type === 'card' ? 'selected' : ''}>Credit card</option><option value="checking" ${a && a.type === 'checking' ? 'selected' : ''}>Checking</option></select><label class="f">Balance</label><input type="text" inputmode="decimal" name="balance" value="${a ? a.balance || '' : ''}"><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Save</button></div>${a && S.accounts.length > 1 ? `<button class="btn danger" type="button" style="margin-top:10px" data-act="delAcct" data-id="${a.id}">Delete</button>` : ''}</form>`);
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
  });
  function setPath(path, val) {
    const p = path.split('.'); let o = S;
    for (let i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = val;
  }
  document.addEventListener('change', async (ev) => {
    const el = ev.target;
    if (el.dataset && el.dataset.path) {
      setPath(el.dataset.path, el.dataset.t === 'n' ? C.round2(C.num(el.value)) : el.value);
      save(); if (el.dataset.re) { const active = el.dataset.path; render(); }
      return;
    }
    if (el.dataset && el.dataset.toggle) { const box = $('#' + el.dataset.toggle); if (box) box.hidden = !el.checked; return; }
    if (el.dataset && el.dataset.ri !== undefined && ui.imp && ui.imp.items) {
      const x = ui.imp.items[+el.dataset.ri], f = el.dataset.f;
      if (f === 'on') x.on = el.checked; else if (f === 'amount') x.amount = Math.abs(C.num(el.value)); else x[f] = el.value;
      if (f === 'on' || f === 'amount') render();
      return;
    }
    if (el.id === 'csvfile' && el.files[0]) { try { await handleCsv(el.files[0]); } catch (e) { toast('Could not read that file'); } el.value = ''; }
    if (el.id === 'imgfile' && el.files[0]) { const f = el.files[0]; el.value = ''; await handleImg(f); }
    if (el.id === 'bkfile' && el.files[0]) {
      try { ui.pendingBackup = await el.files[0].text(); JSON.parse(ui.pendingBackup); } catch (e) { toast('That is not a backup file'); return; }
      el.value = '';
      openSheet(`<h2>Restore backup</h2><p class="muted">This replaces everything on this device with the backup. Enter the passcode the backup was made with.</p><form data-form="restore"><input type="password" name="p" autocomplete="current-password" required><div class="btns"><button class="btn" type="button" data-act="closeSheet">Cancel</button><button class="btn primary" type="submit">Restore</button></div></form>`);
    }
  });

  // ---------- lock / session ----------
  function showLock(forceUnlock) {
    V.exists().then(async (exists) => {
      const face = exists && (await V.faceEnabled());
      $('#app').innerHTML = `<div class="lock"><h1>${exists ? 'Welcome back' : 'Create a passcode'}</h1><p class="muted">${exists ? 'Enter your passcode to unlock.' : 'This encrypts everything on this device. If you forget it, the data cannot be recovered, so keep a backup.'}</p><form data-form="${exists ? 'unlock' : 'setup'}"><input type="password" name="p" autocomplete="${exists ? 'current-password' : 'new-password'}" placeholder="Passcode" required>${exists ? '' : '<input type="password" name="p2" autocomplete="new-password" placeholder="Repeat passcode" style="margin-top:10px" required>'}<div class="err" id="lockerr"></div><button class="btn primary" id="lockbtn" type="submit">${exists ? 'Unlock' : 'Create'}</button>${exists ? '' : '<button class="btn" name="persona" value="blank" type="submit" style="margin-top:10px">I\'m not Mahi</button><p class="muted small" style="margin-top:12px">Mahi\'s budget numbers are preloaded. Tap I\'m not Mahi for a blank setup where you enter your own numbers.</p>'}</form>${face ? '<button class="btn" style="margin-top:12px" data-act="faceUnlock">Unlock with Face ID</button>' : ''}</div>`;
      const p = $('input[name=p]'); if (p) setTimeout(() => p.focus(), 50);
      if (face && !forceUnlock) { /* user taps the button to start Face ID */ }
    });
  }
  actions.faceUnlock = async () => {
    try { const st = await V.unlockFace(); S = Object.assign(defaultState(), st || {}); startSession(); }
    catch (e) { const err = $('#lockerr'); if (err) err.textContent = 'Face ID did not work. Use your passcode.'; }
  };
  function startSession() { fails = 0; hiddenAt = 0; ui.tab = 'home'; ui.more = null; render(); }
  async function lock() {
    await flush(); V.lock(); S = null; closeSheet(); showLock();
  }
  document.addEventListener('visibilitychange', async () => {
    document.body.classList.toggle('hidden', document.hidden);
    if (document.hidden) { hiddenAt = Date.now(); await flush(); }
    else if (S && hiddenAt && Date.now() - hiddenAt > MIN5) lock();
  });
  window.addEventListener('pagehide', () => { hiddenAt = hiddenAt || Date.now(); flush(); });

  // ---------- display size (per device, not encrypted so it applies on the lock screen too) ----------
  function getScale() { try { const v = parseFloat(localStorage.getItem('moneyui')); return v >= 0.7 && v <= 1.3 ? v : 1; } catch (e) { return 1; } }
  function applyScale(v) { document.documentElement.style.zoom = v === 1 ? '' : String(v); }
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
  actions.updateApp = async () => {
    toast('Updating');
    try {
      await flush();
      const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    location.reload();
  };
  actions.setTheme = (d) => { try { localStorage.setItem('moneytheme', d.v); } catch (e) {} applyTheme(d.v); render(); };
  applyTheme(getTheme());
  applyScale(getScale());

  // ---------- boot ----------
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  showLock();
})();
