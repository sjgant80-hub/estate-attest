// gen-digest.mjs — generate estate-digest.json from the real estate-index.json.
//
// The digest is a COMPACT projection of the index: just the fields the attest kernel grades
// (name + the five booleans + desc presence), plus the index's own stored headline. It is a
// GENERATED artifact — never hand-typed (one-kernel-rule). Re-run this against a fresh index to
// refresh the page's ground truth. The page then re-runs the kernel over this digest in the browser.
//
//   node gen-digest.mjs --index <path-to-estate-index.json> [--out estate-digest.json]
//
// Default --index path is the estate memory copy, so a bare run works on Simon's machine.

import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? (argv[i + 1] || d) : d; };
const DEFAULT_INDEX =
  'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const indexPath = val('--index', DEFAULT_INDEX);
const outPath = val('--out', 'estate-digest.json');

const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
const nodes = Array.isArray(idx.nodes) ? idx.nodes : [];

// Compact per-node projection. Keep names (repo-level claims need them) + the graded booleans +
// a precomputed desc-presence flag so the digest carries no free text (keeps it small and clean).
const projected = nodes.map((n) => ({
  name: String(n && n.name != null ? n.name : ''),
  private: n && n.private === true,
  live: n && n.live === true,
  pages: n && n.pages === true,
  archived: n && n.archived === true,
  fork: n && n.fork === true,
  desc: n && typeof n.desc === 'string' && n.desc.trim() ? 'y' : '', // presence only, never the text
}));

const digest = {
  org: String(idx.org || 'sjgant80-hub'),
  generated: String(idx.generated || ''),
  verified: String(idx.verified || ''),
  // the index's OWN stored headline — what it claims about itself, graded by the `consistent` kind
  stored: {
    total: Number(idx.total),
    public: Number(idx.public),
    private: Number(idx.private),
    live: Number(idx.live),
    withDesc: Number(idx.withDesc),
  },
  source: 'estate-index.json',
  nodes: projected,
};

writeFileSync(outPath, JSON.stringify(digest));
console.log(`wrote ${outPath}: ${projected.length} nodes · stored ${JSON.stringify(digest.stored)}`);
