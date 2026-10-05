// ════════════════════════════════════════════════════════════════
// estate-attest · kernel — the trust rail turned INWARD, on the estate itself.
//
// The estate's one defensible asset is proof-by-re-running. Its one recurring wound is the gap
// between a CLAIM ("1,768 repos", "540 pages live", "claudedidy is private") and a VERIFIED fact.
// This kernel closes that gap for the estate's own self-description:
//
//   given  the estate's FACTS  (a digest of the real estate-index.json — generated, never typed)
//   and    a MANIFEST of CLAIMS (the estate's own statements about itself — from memory + the index headlines)
//   return a verdict for every claim: HOLDS (recompute matches) or DRIFTED (it does not), with both numbers.
//
// Pure. Zero I/O. Deterministic. proof-by-re-running: the browser runs THIS EXACT FILE and MUST
// reach the same verdicts as CI running it on GitHub's own runner. A claim you cannot re-run is a
// claim on trust — and the estate's rule is proof over promise, applied here to itself.
//
// Boundary contract: attest() and recompute() NEVER throw, on any input (fuzz-gated).
// ════════════════════════════════════════════════════════════════

// Safe truthy field read — never throws (a toxic getter, a null node, a primitive), so the callers
// that iterate untrusted nodes honour the never-throw boundary the fuzz gate enforces.
export function isTrue(node, key) {
  try { return !!node && node[key] === true; } catch { return false; }
}

// A node "has a description" iff desc is a non-empty string after trimming — the exact rule the index
// generator used to compute its own `withDesc`, so our recompute is comparable to the stored headline.
export function hasDesc(node) {
  try { return !!node && typeof node.desc === 'string' && node.desc.trim().length > 0; } catch { return false; }
}

// The comparators a count-claim may use. Pure. NaN (non-numeric either side) yields false for every op —
// an un-gradable claim is never silently "held". 'approx' tolerates ±tol.
export function cmp(op, actual, expected, tol = 0) {
  const a = Number(actual), e = Number(expected), t = Number(tol) || 0;
  switch (op) {
    case 'eq':     return a === e;
    case 'ge':     return a >= e;
    case 'le':     return a <= e;
    case 'gt':     return a > e;
    case 'lt':     return a < e;
    case 'approx': return Math.abs(a - e) <= t;
    default:       return false;
  }
}

// Find a repo node by name, case-insensitively, tolerant of hostile entries. null when absent.
export function findNode(nodes, name) {
  const arr = Array.isArray(nodes) ? nodes : [];
  const want = String(name == null ? '' : name).toLowerCase();
  for (const n of arr) {
    try { if (!!n && String(n.name).toLowerCase() === want) return n; } catch { /* hostile node, skip */ }
  }
  return null;
}

// Recompute every headline aggregate FROM THE RAW NODES — the ground truth the claims are graded against.
// This is the whole point: the numbers are computed here, not copied from the index's stored headline.
export function recompute(nodes) {
  const arr = Array.isArray(nodes) ? nodes : [];
  let total = 0, priv = 0, live = 0, pages = 0, archived = 0, forks = 0, withDesc = 0;
  for (const n of arr) {
    total += 1;
    if (isTrue(n, 'private')) priv += 1;
    if (isTrue(n, 'live')) live += 1;
    if (isTrue(n, 'pages')) pages += 1;
    if (isTrue(n, 'archived')) archived += 1;
    if (isTrue(n, 'fork')) forks += 1;
    if (hasDesc(n)) withDesc += 1;
  }
  return { total, public: total - priv, private: priv, live, pages, archived, forks, withDesc };
}

// Grade ONE claim against the recomputed facts (and the raw nodes, for repo-level claims).
// Claim kinds:
//   count      {metric, op, expected, tol?}  — a recomputed aggregate compared to a stated number
//   consistent {metric, stored}              — the index's OWN stored headline must equal the recompute
//                                              (the index not lying to itself)
//   repo       {name, private?, live?}       — a named repo exists, with optional flag assertions
export function checkClaim(claim, facts, nodes) {
  try {
    const c = claim && typeof claim === 'object' ? claim : {};
    const base = {
      id: String(c.id == null ? '' : c.id),
      label: String(c.label == null ? '' : c.label),
      kind: String(c.kind == null ? '' : c.kind),
      source: String(c.source == null ? '' : c.source),
    };
    const f = facts && typeof facts === 'object' ? facts : {};
    if (c.kind === 'count') {
      const actual = Number(f[c.metric]);
      const holds = cmp(String(c.op || 'eq'), actual, c.expected, c.tol);
      return { ...base, holds, metric: String(c.metric || ''), op: String(c.op || 'eq'), claimed: c.expected, actual };
    }
    if (c.kind === 'consistent') {
      const actual = Number(f[c.metric]);
      const stored = Number(c.stored);
      const holds = cmp('eq', actual, stored);
      return { ...base, holds, metric: String(c.metric || ''), op: 'eq', claimed: stored, actual };
    }
    if (c.kind === 'repo') {
      const node = findNode(nodes, c.name);
      let holds = !!node;
      if (holds && c.private !== undefined) holds = holds && (isTrue(node, 'private') === (c.private === true));
      if (holds && c.live !== undefined)    holds = holds && (isTrue(node, 'live') === (c.live === true));
      return {
        ...base, holds,
        claimed: { name: String(c.name || ''), private: c.private, live: c.live },
        actual: node ? { exists: true, private: isTrue(node, 'private'), live: isTrue(node, 'live') } : { exists: false },
      };
    }
    return { ...base, holds: false, claimed: null, actual: null, detail: 'unknown claim kind' };
  } catch {
    return { id: '', label: '', kind: '', source: '', holds: false, claimed: null, actual: null, detail: 'error grading claim' };
  }
}

// THE BOUNDARY. Given a digest ({ org, generated, verified, stored, nodes:[…] }) and a manifest
// (an array of claims, or { claims:[…] }), recompute the facts and grade every claim. Never throws.
export function attest(digest, manifest) {
  try {
    const d = digest && typeof digest === 'object' && !Array.isArray(digest) ? digest : {};
    const nodes = Array.isArray(d.nodes) ? d.nodes : (Array.isArray(digest) ? digest : []);
    const facts = recompute(nodes);
    const claims = Array.isArray(manifest) ? manifest
                 : (manifest && typeof manifest === 'object' && Array.isArray(manifest.claims) ? manifest.claims : []);
    const results = [];
    for (const claim of claims) results.push(checkClaim(claim, facts, nodes));
    let held = 0, drifted = 0;
    for (const r of results) {
      if (r.holds === true) held += 1;
      else drifted += 1;
    }
    const clean = drifted === 0 && results.length > 0;
    return {
      org: typeof d.org === 'string' ? d.org : '',
      generated: typeof d.generated === 'string' ? d.generated : '',
      verified: typeof d.verified === 'string' ? d.verified : '',
      facts,
      stored: d.stored && typeof d.stored === 'object' ? d.stored : null,
      results,
      summary: { total: results.length, held, drifted, clean },
    };
  } catch {
    return {
      org: '', generated: '', verified: '', facts: recompute([]), stored: null,
      results: [], summary: { total: 0, held: 0, drifted: 0, clean: false },
    };
  }
}

export default { isTrue, hasDesc, cmp, findNode, recompute, checkClaim, attest };
