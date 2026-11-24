#!/usr/bin/env node
/**
 * Record the real Cloudflare KV namespace id for the STATS binding.
 *
 *   node kv-id.mjs          # look the id up in your Cloudflare account and write wrangler.toml
 *   node kv-id.mjs --check  # only report: is `id` a real namespace id? (exit 1 if not)
 *
 * Why this exists: `wrangler deploy` with a placeholder id fails, and `wrangler kv namespace
 * create STATS` run a second time makes a NEW empty namespace — which silently orphans the live
 * aggregates. This script reuses the namespace that already exists.
 *
 * Credentials come from wrangler itself (`npx wrangler login` once). Overrides for CI:
 *   WRANGLER=/path/to/wrangler   use a specific binary instead of `npx wrangler`
 *   STATS_KV_ID=<32 hex>         skip the lookup entirely
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOML_PATH = join(HERE, 'wrangler.toml');
const CHECK_ONLY = process.argv.includes('--check');
const PLACEHOLDERS = new Set(['', 'REPLACE_WITH_KV_NAMESPACE_ID', 'PASTE_KV_NAMESPACE_ID']);
const ID_RE = /^[0-9a-f]{32}$/;
const TITLE = 'STATS';

const fail = (msg) => { console.error(msg); process.exit(1); };

function readTomlId() {
  const m = readFileSync(TOML_PATH, 'utf8').match(/^\s*id\s*=\s*"([^"]*)"/m);
  return m ? m[1].trim() : '';
}

function saveId(id) {
  const src = readFileSync(TOML_PATH, 'utf8');
  if (!/^\s*id\s*=\s*"[^"]*"/m.test(src)) fail(`No \`id = "..."\` line in ${TOML_PATH}`);
  writeFileSync(TOML_PATH, src.replace(/^\s*id\s*=\s*"[^"]*"/m, `id = "${id}"`));
}

function runWrangler(args) {
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  const binary = process.env.WRANGLER;
  if (binary && /\.m?js$/.test(binary)) return execFileSync(process.execPath, [binary, ...args], opts);
  if (binary) return execFileSync(binary, args, opts);
  return execFileSync('npx', ['--yes', 'wrangler', ...args], opts);
}

function listNamespaces() {
  const attempts = [['kv', 'namespace', 'list', '--json'], ['kv:namespace', 'list', '--json']];
  let lastErr;
  for (const args of attempts) {
    try {
      const raw = runWrangler(args);
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.result) ? parsed.result : null);
      if (!list) throw new Error('unexpected output shape');
      return list;
    } catch (err) {
      lastErr = err;
    }
  }
  const detail = (lastErr && (lastErr.stderr || lastErr.message) || '').toString().trim().split('\n')[0];
  fail(`Could not list KV namespaces${detail ? `: ${detail}` : '.'}\n` +
       `Run \`npx wrangler login\` once, then try again.`);
}

function main() {
  const id = readTomlId();
  const real = ID_RE.test(id);
  const force = process.argv.includes('--force') || !!process.env.STATS_KV_ID;

  if (CHECK_ONLY) {
    if (real) { console.log(`ok — wrangler.toml binds STATS to ${id}`); return; }
    console.error(`not configured — wrangler.toml has ${id ? `"${id}"` : 'no id'} instead of a 32-hex ` +
                  `namespace id. Fix with: node worker/kv-id.mjs`);
    process.exit(1);
  }

  if (real && !force) {
    console.log(`already set — wrangler.toml binds STATS to ${id} (use --force to look it up again)`);
    return;
  }

  let resolved = (process.env.STATS_KV_ID || '').trim();
  if (resolved && !ID_RE.test(resolved)) fail('STATS_KV_ID is not a 32-hex namespace id');

  if (!resolved) {
    const matches = listNamespaces().filter(ns => String(ns.title || '').toUpperCase() === TITLE);
    if (matches.length === 0) {
      fail(`No KV namespace named ${TITLE} in this account.\n` +
           `If the worker was never deployed, create it once: npx wrangler kv namespace create ${TITLE}`);
    }
    if (matches.length > 1) {
      fail(`Found ${matches.length} namespaces named ${TITLE} — refusing to guess:\n` +
           matches.map(ns => `  ${ns.id}`).join('\n') +
           `\nPick the one the live worker uses and set it with: STATS_KV_ID=<id> node worker/kv-id.mjs`);
    }
    resolved = String(matches[0].id);
    if (!ID_RE.test(resolved)) fail(`wrangler returned an unexpected id: ${resolved}`);
  }

  if (resolved === id) { console.log(`unchanged — STATS already bound to ${resolved}`); return; }
  saveId(resolved);
  console.log(`wrote wrangler.toml: STATS -> ${resolved}`);
  console.log('Next: cd worker && npx wrangler deploy');
}

main();
