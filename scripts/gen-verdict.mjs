// gen-verdict.mjs — the estate-attest card's numbers, GENERATED from the real attestation.
// Writes data/verdict.json: the sealed verdict other surfaces (e.g. the FallWorld Deck) vendor.
// The numbers are the kernel's own output over the committed digest + manifest — never typed.
//
//   node scripts/gen-verdict.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { attest } from '../kernel/attest.mjs';

const digest = JSON.parse(readFileSync(new URL('../estate-digest.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const r = attest(digest, manifest);

const verdict = {
  held: r.summary.held,
  of: r.summary.total,
  clean: r.summary.clean,
  total: r.facts.total,
  public: r.facts.public,
  private: r.facts.private,
  live: r.facts.live,
  pages: r.facts.pages,
  withDesc: r.facts.withDesc,
  generated: digest.generated,
  sealedIn: '',
  note: "estate-attest's own re-runnable verdict: the estate's claims about itself, graded against the real index.",
};

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/verdict.json', import.meta.url), JSON.stringify(verdict, null, 2) + '\n');
console.log('wrote data/verdict.json:', JSON.stringify({ held: verdict.held, of: verdict.of, total: verdict.total, pages: verdict.pages, live: verdict.live }));
