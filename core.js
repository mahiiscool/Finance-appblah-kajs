(function (root) {
  'use strict';
  const Core = {};
  const pad = (n) => String(n).padStart(2, '0');
  Core.ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  Core.parse = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  Core.today = () => Core.ymd(new Date());
  Core.addDays = (s, n) => { const d = Core.parse(s); d.setDate(d.getDate() + n); return Core.ymd(d); };
  Core.weekStart = (s) => { const d = Core.parse(s); d.setDate(d.getDate() - d.getDay()); return Core.ymd(d); };
  Core.monthKey = (s) => s.slice(0, 7);
  Core.addMonths = (s, n) => {
    const d = Core.parse(s); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return Core.ymd(d);
  };
  Core.shiftMonthKey = (mk, n) => Core.monthKey(Core.addMonths(mk + '-01', n));
  Core.daysBetween = (a, b) => Math.round((Core.parse(b) - Core.parse(a)) / 86400000);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  // Always shows the absolute value. Callers use words like "over" for negatives.
  Core.money = (n) => fmt.format(Math.abs(Math.round((n + Number.EPSILON) * 100) / 100));
  Core.cents = (n) => Math.round(n * 100);
  Core.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  Core.monthName = (mk) => {
    const p = mk.split('-').map(Number);
    return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };
  Core.longDate = (s) => Core.parse(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  Core.shortDate = (s) => Core.parse(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  Core.status = (pct) => (pct > 1 ? 'r' : pct >= 0.8 ? 'y' : 'g');

  Core.num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    const s = String(v == null ? '' : v).replace(/[$,\s]/g, '');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  // CSV parsing with quotes, CRLF, and delimiter detection
  Core.parseCSV = (text) => {
    text = String(text).replace(/^\uFEFF/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let q = false;
    for (const ch of first) { if (ch === '"') q = !q; else if (!q && counts[ch] !== undefined) counts[ch]++; }
    const delim = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = []; let row = [], cur = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cur += ch;
    }
    row.push(cur);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    return rows;
  };

  Core.parseAmount = (str) => {
    let s = String(str == null ? '' : str).trim();
    if (!s) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/^[-\u2212]/.test(s) || /[-\u2212]$/.test(s)) neg = true;
    s = s.replace(/[^0-9.]/g, '');
    const n = parseFloat(s);
    if (!isFinite(n)) return NaN;
    return neg ? -n : n;
  };

  Core.parseDate = (str, fallback) => {
    const s = String(str || '').trim();
    let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + pad(+m[1]) + '-' + pad(+m[2]); }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Core.ymd(d);
    return fallback || Core.today();
  };

  Core.cleanMerchant = (s) =>
    String(s || '').replace(/\s+/g, ' ').replace(/\b(pos|purchase|debit|card|ach|web id|#)\b.*$/i, '').trim().slice(0, 60);

  Core.categorize = (desc, rules) => {
    const d = String(desc || '').toLowerCase();
    for (const r of rules) { if (r.match && d.includes(r.match.toLowerCase())) return r.cat; }
    return 'other';
  };

  Core.dupKey = (date, amount) => date + '|' + Core.cents(amount);

  // Parse OCR text from a spending screen into rows
  Core.parseOcr = (text, rules, defaultDate) => {
    const rows = []; let date = defaultDate || Core.today();
    const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
    const dateRe = new RegExp('\\b(' + months + ')[a-z]*\\.?\\s+(\\d{1,2})(?:,?\\s*(\\d{4}))?', 'i');
    const moneyRe = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})\b/g;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const matches = [...line.matchAll(moneyRe)];
      const dm = line.match(dateRe);
      if (dm && matches.length === 0) {
        const y = dm[3] ? +dm[3] : new Date().getFullYear();
        const mi = months.split('|').indexOf(dm[1].slice(0, 3).toLowerCase());
        date = y + '-' + pad(mi + 1) + '-' + pad(+dm[2]);
        continue;
      }
      if (!matches.length) continue;
      const m = matches[matches.length - 1];
      const amount = parseFloat(m[1].replace(/,/g, '') + '.' + m[2]);
      let desc = line.slice(0, m.index).replace(/[|_$]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!desc) desc = 'Imported purchase';
      rows.push({ date, desc, amount, cat: Core.categorize(desc, rules) });
    }
    return rows;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
