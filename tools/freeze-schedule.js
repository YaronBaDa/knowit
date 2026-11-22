#!/usr/bin/env node
/**
 * freeze-schedule.js — turn KNOWIT's computed daily schedule into a committed, append-only file.
 *
 * Reads the scheduling code straight out of index.html (same source the game runs), calls
 * getDailySetIds / orderedDailyIds for every puzzle number, and writes schedule.json.
 *
 *   node tools/freeze-schedule.js            # append any missing days up to day 120
 *   node tools/freeze-schedule.js --days 365 # extend further
 *   node tools/freeze-schedule.js --check     # report drift only, write nothing
 *
 * Existing day entries are NEVER rewritten. If a recomputed day disagrees with the stored one,
 * the stored one wins and a warning is printed: that means QUESTIONS / HOLD_IDS changed under a
 * published puzzle, and old challenge links are now at risk.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const OUT_PATH = path.join(ROOT, 'schedule.json');
const LAUNCH = '2026-11-18';
const VERSION = 1;

const argv = process.argv.slice(2);
const CHECK_ONLY = argv.includes('--check');
const daysArg = argv.indexOf('--days');
const TARGET_DAYS = daysArg !== -1 ? Math.max(1, parseInt(argv[daysArg + 1], 10) || 120) : 120;

// ---------------------------------------------------------------- source extraction

const html = fs.readFileSync(HTML_PATH, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
if (!scriptMatch) throw new Error('index.html: no <script> block found');
const script = scriptMatch
  .map(m => m.replace(/^<script>/, '').replace(/<\/script>$/, ''))
  .find(s => s.includes('const QUESTIONS'))
  || '';
if (!script) throw new Error('index.html: could not find the main script (no QUESTIONS array)');

// Walk forward from `open` (which must be "{" or "[") to its partner, ignoring strings/comments.
function matchBracket(src, open) {
  const pairs = { '{': '}', '[': ']', '(': ')' };
  const close = pairs[open];
  let depth = 0, i = src.indexOf(open);
  if (i === -1) throw new Error('matchBracket: not found');
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') { i++; continue; }
        if (src[i] === quote) break;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 1; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  throw new Error('matchBracket: unbalanced ' + open);
}

function takeFunction(src, name) {
  const start = src.search(new RegExp('(^|\\n)function ' + name + '\\s*\\('));
  if (start === -1) throw new Error('index.html: function ' + name + '() not found');
  const bodyStart = src.indexOf('{', src.indexOf('(', start));
  const end = matchBracket(src.slice(bodyStart), '{') + bodyStart;
  return src.slice(start, end + 1).trim();
}

function takeDeclaration(src, re, label) {
  const m = src.match(re);
  if (!m) throw new Error('index.html: ' + label + ' not found');
  const at = m.index;
  const open = m[1];
  const bracketStart = at + m[0].length - 1;   // m[0] ends on the opening bracket
  const end = matchBracket(src.slice(bracketStart), open) + bracketStart;
  const lineEnd = src.indexOf('\n', end);
  return src.slice(at, lineEnd === -1 ? src.length : lineEnd).trim();
}

function takeLine(src, re, label) {
  const m = src.match(re);
  if (!m) throw new Error('index.html: ' + label + ' not found');
  const end = src.indexOf('\n', m.index);
  return src.slice(m.index, end === -1 ? src.length : end).trim();
}

const parts = [
  takeFunction(script, 'mulberry32'),
  takeFunction(script, 'seededShuffle'),
  takeDeclaration(script, /const QUESTIONS = (\[)/, 'QUESTIONS'),
  takeLine(script, /^const SET_TIERS\s*=/m, 'SET_TIERS'),
  takeLine(script, /^const TIER_SHUFFLE_FROM\s*=/m, 'TIER_SHUFFLE_FROM'),
  takeLine(script, /^const CAT_CAP\s*=/m, 'CAT_CAP'),
  takeLine(script, /^const HOLD_IDS\s*=/m, 'HOLD_IDS'),
  takeLine(script, /^const NO_SAME_DAY\s*=/m, 'NO_SAME_DAY'),
  // Whole scheduling block: tier pools → buildNextDay → getDailySetIds → orderedDailyIds
  (() => {
    const at = script.indexOf('// Deterministic daily schedule');
    if (at === -1) throw new Error('index.html: scheduling block not found');
    const fnStart = script.indexOf('function orderedDailyIds', at);
    const bodyStart = script.indexOf('{', fnStart);
    const fnEnd = matchBracket(script.slice(bodyStart), '{') + bodyStart;
    return script.slice(at, fnEnd + 1);
  })(),
];

const source = parts.join('\n\n') + '\n\nglobalThis.__api = { QUESTIONS, getDailySetIds, orderedDailyIds };\n';

const sandbox = {
  console,
  // The scheduling slice needs none of these, but keep the sandbox harmless if that ever changes.
  document: { createElement: () => ({}), addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  window: {},
  // The block also contains the optional schedule.json loader; it stays inert in here.
  setTimeout: () => 0,
  clearTimeout: () => {},
  fetch: () => Promise.reject(new Error('offline (freeze-schedule)')),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'index.html#schedule' });

const api = sandbox.__api;
const questions = api.QUESTIONS;
if (!Array.isArray(questions) || !questions.length) throw new Error('QUESTIONS array is empty');
const known = new Set(questions.map(q => q.id));

// ---------------------------------------------------------------- compute

function computeDay(n) {
  const ids = typeof api.orderedDailyIds === 'function' ? api.orderedDailyIds(n) : api.getDailySetIds(n);
  return Array.from(ids);
}

// ---------------------------------------------------------------- merge

function readExisting() {
  if (!fs.existsSync(OUT_PATH)) return null;
  const raw = fs.readFileSync(OUT_PATH, 'utf8');
  try {
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object' || !json.days) throw new Error('bad shape');
    return json;
  } catch (e) {
    throw new Error('schedule.json is not valid JSON (' + e.message + ') — refusing to overwrite it');
  }
}

const existing = readExisting();
const days = existing ? { ...existing.days } : {};
const storedNumbers = Object.keys(days).map(Number).filter(n => Number.isFinite(n) && n > 0);
const highest = storedNumbers.length ? Math.max(...storedNumbers) : 0;
const lastDay = Math.max(highest, TARGET_DAYS);

const drift = [];
const added = [];

for (let n = 1; n <= lastDay; n++) {
  const computed = computeDay(n);
  if (computed.length !== 10) throw new Error('day ' + n + ' produced ' + computed.length + ' ids (expected 10)');
  const unknown = computed.filter(id => !known.has(id));
  if (unknown.length) throw new Error('day ' + n + ' references unknown ids: ' + unknown.join(', '));

  const stored = days[String(n)];
  if (Array.isArray(stored) && stored.length) {
    // Published days are immutable: keep the stored order, report any drift.
    if (stored.join(',') !== computed.join(',')) drift.push(n);
    continue;
  }
  days[String(n)] = computed;
  added.push(n);
}

const sortedDays = {};
Object.keys(days)
  .map(Number)
  .sort((a, b) => a - b)
  .forEach(n => { sortedDays[String(n)] = days[String(n)]; });

const out = {
  version: existing && existing.version ? existing.version : VERSION,
  launch: (existing && existing.launch) || LAUNCH,
  days: sortedDays,
};

if (drift.length) {
  console.warn('\n⚠  ' + drift.length + ' published day(s) no longer recompute the same:');
  console.warn('   ' + drift.slice(0, 20).join(', ') + (drift.length > 20 ? ', …' : ''));
  console.warn('   Stored ids were kept. If this was intentional, delete those days from schedule.json.');
}

if (CHECK_ONLY) {
  console.log('check only — ' + (added.length ? added.length + ' day(s) missing' : 'schedule is complete through day ' + lastDay));
  if (added.length) console.log('missing: ' + added.slice(0, 20).join(', ') + (added.length > 20 ? ', …' : ''));
  process.exit(drift.length ? 2 : 0);
}

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(
  'schedule.json — ' + Object.keys(sortedDays).length + ' days'
  + (added.length ? ' (' + added.length + ' added: ' + added[0] + '…' + added[added.length - 1] + ')' : ' (no changes)')
  + (drift.length ? ', ' + drift.length + ' drift warning(s)' : '')
);
