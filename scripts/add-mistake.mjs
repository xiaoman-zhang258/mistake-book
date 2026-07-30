#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const indexPath = path.join(repoRoot, 'index.html');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) fail(`Unexpected argument: ${key}`);
    const name = key.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) fail(`Missing value for --${name}`);
    out[name] = value;
    i += 1;
  }
  return out;
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

function loadEntry() {
  const stdin = readStdin();
  if (stdin) {
    try {
      return JSON.parse(stdin);
    } catch (err) {
      fail(`Stdin is not valid JSON: ${err.message}`);
    }
  }
  return parseArgs(process.argv.slice(2));
}

function js(value) {
  return JSON.stringify(String(value ?? ''))
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const entry = loadEntry();
const required = ['subject', 'q', 'mine', 'right', 'why', 'fix'];
for (const field of required) {
  if (!String(entry[field] ?? '').trim()) fail(`Missing required field: ${field}`);
}

const date = String(entry.date || new Date().toISOString().slice(0, 10));
const html = fs.readFileSync(indexPath, 'utf8');
const seedStart = html.indexOf('const SEED = [');
if (seedStart === -1) fail('Could not find const SEED = [ in index.html');

const seedEnd = html.indexOf('\n];', seedStart);
if (seedEnd === -1) fail('Could not find the end of SEED array in index.html');

const seedBlock = html.slice(seedStart, seedEnd);
const ids = [...seedBlock.matchAll(/\bid:\s*(\d+)/g)].map(match => Number(match[1]));
const nextId = ids.length ? Math.max(...ids) + 1 : 1;

const object = [
  '  {',
  `    id: ${nextId}, subject:${js(entry.subject)}, date:${js(date)},`,
  `    q:${js(entry.q)},`,
  `    mine:${js(entry.mine)},`,
  `    right:${js(entry.right)},`,
  `    why:${js(entry.why)},`,
  `    fix:${js(entry.fix)}`,
  '  },',
  ''
].join('\n');

const updated = html.slice(0, seedEnd) + object + html.slice(seedEnd);
fs.writeFileSync(indexPath, updated);

console.log(`Added mistake #${nextId} to ${indexPath}`);
