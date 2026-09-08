#!/usr/bin/env node
/**
 * Daily draw.
 *
 *   node tools/draw.mjs --dry-run      preview without writing
 *   node tools/draw.mjs                run it
 *   node tools/draw.mjs --seed <seed>  record a draw the endpoint published
 *   node tools/draw.mjs --verify <seed> --date "September 6,2026"
 *
 * What it does to users.json, matching how the file has been kept so far:
 *   1. removes the previous winner (names[0]) from the entry pool
 *   2. picks a new winner from what's left
 *   3. moves that winner to names[0]  ← this is the value the page reveals
 *   4. prepends { name, date } to winner_history
 *
 * Selection uses SHA-256(seed + date) so the result is reproducible. Keep the
 * seed secret until the draw, publish it after, and anyone can re-run --verify
 * to confirm you didn't pick the name by hand.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'users.json');
const BACKUPS = join(ROOT, 'backups');
const LEDGER = join(ROOT, 'draw-log.jsonl');

const args = process.argv.slice(2);
const has = flag => args.includes(flag);
const val = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1]; };

/** "September 6,2026" — the format already used in winner_history. */
function drawDate(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric'
  }).formatToParts(now);
  const g = t => p.find(x => x.type === t).value;
  return `${g('month')} ${g('day')},${g('year')}`;
}

/** Deterministic index from a seed and a date — no bias, no modulo skew. */
function pickIndex(seed, date, count) {
  for (let counter = 0; ; counter++) {
    const digest = createHash('sha256').update(`${seed}:${date}:${counter}`).digest();
    const draw = digest.readUInt32BE(0);
    const limit = Math.floor(0x100000000 / count) * count;
    if (draw < limit) return draw % count;   // reject-and-retry keeps it uniform
  }
}

/** The entry pool for a draw: everything except the previous winner. */
function derivePool(file) {
  const previous = file.names[0];
  const alreadyLogged = file.winner_history.some(e => e.name === previous);
  return { pool: alreadyLogged ? file.names.slice(1) : file.names.slice(), previous, alreadyLogged };
}

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const date = val('--date') ?? drawDate();

// --verify: reproduce a past draw from its published seed
if (has('--verify')) {
  const seed = val('--verify');
  // Must be the file as it stood *before* the draw, so the pool matches.
  const { pool } = derivePool(JSON.parse(readFileSync(val('--pool') ?? DATA, 'utf8')));
  const idx = pickIndex(seed, date, pool.length);
  console.log(`date  ${date}\nseed  ${seed}\nindex ${idx} of ${pool.length}\nname  ${pool[idx]}`);
  process.exit(0);
}

if (data.winner_history[0]?.date === date && !has('--force')) {
  console.error(`A draw for ${date} already exists. Use --force to redo it.`);
  process.exit(1);
}

const { pool, previous, alreadyLogged } = derivePool(data);

// --seed reproduces a draw the endpoint already published; without it, mint one.
const seed = val('--seed') ?? randomBytes(32).toString('hex');
const index = pickIndex(seed, date, pool.length);
const winner = pool[index];

const poolHash = createHash('sha256').update(JSON.stringify(pool)).digest('hex');

console.log(`date        ${date}`);
console.log(`pool        ${pool.length} entries (was ${data.names.length})`);
console.log(`pool sha256 ${poolHash}`);
console.log(`removed     ${alreadyLogged ? previous : '(none — previous winner not in history)'}`);
console.log(`index       ${index}`);
console.log(`WINNER      ${winner}`);
console.log(`seed        ${seed}`);

if (has('--dry-run')) {
  console.log('\n--dry-run: nothing written.');
  process.exit(0);
}

// Winner first, everyone else after — names[0] is what the page reveals.
data.names = [winner, ...pool.filter((_, i) => i !== index)];
data.winner_history.unshift({ name: winner, date });

if (!existsSync(BACKUPS)) mkdirSync(BACKUPS);
copyFileSync(DATA, join(BACKUPS, `users.${date.replace(/[ ,]/g, '-')}.json`));
writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');

writeFileSync(LEDGER, JSON.stringify({
  date, winner, index, seed, poolHash, poolSize: pool.length,
  ranAt: new Date().toISOString()
}) + '\n', { flag: 'a' });

console.log(`\nWrote users.json (${data.names.length} names, ${data.winner_history.length} history entries).`);
console.log(`Backup and audit line saved. Publish the seed after the draw so it can be checked.`);
