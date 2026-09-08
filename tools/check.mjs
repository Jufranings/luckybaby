#!/usr/bin/env node
/**
 * Checks users.json before you push.
 *
 *   node tools/check.mjs
 *
 * Exits 0 if the file is safe to publish, 1 if something would break the page.
 * Nothing is modified — this only reads.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = process.argv[2]
  ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'users.json');

const errors = [];
const warnings = [];
const err = m => errors.push(m);
const warn = m => warnings.push(m);

/* ---------- 1. Does it parse at all? ---------- */

let raw, data;
try {
  raw = readFileSync(FILE, 'utf8');
} catch {
  console.error(`Cannot read ${FILE}`);
  process.exit(1);
}

try {
  data = JSON.parse(raw);
} catch (e) {
  // A syntax error means the page shows "Waiting for Today's Lucky Winner"
  // forever. Point at the exact line so it's a one-second fix in VS Code.
  const pos = /position (\d+)/.exec(e.message)?.[1];
  console.error('INVALID JSON — the page will not load this file.\n');
  console.error(`  ${e.message}`);
  if (pos) {
    const line = raw.slice(0, +pos).split('\n').length;
    console.error(`  around line ${line}`);
    console.error(`\n  In VS Code: Ctrl+G (Cmd+G on Mac), type ${line}, Enter.`);
    console.error('  Usually a trailing comma or a missing quote.');
  }
  process.exit(1);
}

/* ---------- 2. Shape ---------- */

if (!Array.isArray(data.names)) err('`names` is missing or not an array.');
if (!Array.isArray(data.winner_history)) err('`winner_history` is missing or not an array.');
if (errors.length) { report(); process.exit(1); }

if (!data.names.length) err('`names` is empty — there is nobody to reveal.');

/* ---------- 3. The entry pool ---------- */

data.names.forEach((n, i) => {
  if (typeof n !== 'string') err(`names[${i}] is ${typeof n}, expected a string.`);
  else if (!n.trim()) err(`names[${i}] is blank.`);
  else if (n !== n.trim()) warn(`names[${i}] has surrounding whitespace: ${JSON.stringify(n)}`);
});

const seen = new Map();
data.names.forEach((n, i) => {
  if (typeof n !== 'string') return;
  if (seen.has(n)) warn(`"${n}" appears twice in names — index ${seen.get(n)} and ${i}.`);
  else seen.set(n, i);
});

/* ---------- 4. History entries ---------- */

const KNOWN = new Set(['name', 'date']);
data.winner_history.forEach((entry, i) => {
  if (typeof entry !== 'object' || entry === null) {
    err(`winner_history[${i}] is not an object.`);
    return;
  }
  const keys = Object.keys(entry);
  // Catches "neme"/"data" style typos — these render blank in the overlay.
  for (const k of keys) {
    if (!KNOWN.has(k)) {
      const guess = k.length === 4 && /^n/.test(k) ? 'name' : k.length === 4 ? 'date' : null;
      err(`winner_history[${i}] has key "${k}"${guess ? ` — did you mean "${guess}"?` : ''} ${JSON.stringify(entry)}`);
    }
  }
  if (!entry.name) err(`winner_history[${i}] has no name: ${JSON.stringify(entry)}`);
  if (!entry.date) err(`winner_history[${i}] has no date: ${JSON.stringify(entry)}`);
  else if (!/^[A-Z][a-z]+ \d{1,2},\d{4}$/.test(entry.date)) {
    warn(`winner_history[${i}] date "${entry.date}" — house format is "September 6,2026".`);
  }
});

/* ---------- 5. The invariant the page depends on ---------- */

const top = data.names[0];
const latest = data.winner_history[0];

if (latest && top !== latest.name) {
  err(`names[0] is "${top}" but winner_history[0] is "${latest.name}".\n` +
      `     The page reveals names[0]; the overlay lists winner_history[0].\n` +
      `     These two must be the same person or the board and the history disagree.`);
}

const past = new Set(data.winner_history.map(e => e.name).filter(Boolean));
const stillIn = data.names.filter((n, i) => i > 0 && past.has(n));
if (stillIn.length) {
  warn(`${stillIn.length} previous winners are still in the entry pool ` +
       `(e.g. ${stillIn.slice(0, 3).join(', ')}) — they can be drawn again.`);
}

const dates = data.winner_history.map(e => e.date).filter(Boolean);
const dupeDates = dates.filter((d, i) => dates.indexOf(d) !== i);
if (dupeDates.length) warn(`Repeated dates in winner_history: ${[...new Set(dupeDates)].slice(0, 3).join(' | ')}`);

/* ---------- Report ---------- */

function report() {
  for (const m of errors) console.error(`  ERROR   ${m}`);
  for (const m of warnings.slice(0, 12)) console.warn(`  warn    ${m}`);
  if (warnings.length > 12) console.warn(`  warn    …and ${warnings.length - 12} more warnings.`);
}

console.log(`Checked ${FILE}`);
console.log(`  ${data.names.length} names, ${data.winner_history.length} history entries`);
console.log(`  tonight's reveal: ${top}\n`);

report();

if (errors.length) {
  console.error(`\n${errors.length} error(s). Do not push — the page will break.`);
  process.exit(1);
}
console.log(warnings.length
  ? `\nNo errors. ${warnings.length} warning(s) — safe to push, but worth a look.`
  : '\nAll good. Safe to push.');
