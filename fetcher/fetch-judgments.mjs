// LegalPulse — daily judgment fetcher for the Malaysian E-Judgment portal.
// Loads the real search page (which primes the server session), runs the
// search, then pages through results via the portal's own web service and
// writes a clean judgments.json manifest the app reads.
//
// Usage: node fetch-judgments.mjs [maxRecords]   (default 80, newest first)

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const OUT_DIR = dirname(fileURLToPath(import.meta.url));
// The portal returns the 20 latest per court per search. We loop the courts
// that publish written judgments. Add more codes here if the portal exposes them.
const COURT_CODES = ['FC', 'COA', 'HC'];
const PAGE_URL = (code) =>
  `https://ejudgment.kehakiman.gov.my/EJudgmentWeb//SearchPage.aspx?JurisdictionType=${code}`;
const PDF_BASE = 'https://efs.kehakiman.gov.my/EFSWeb/DocDownloader.aspx?DocumentID=';

// Map the portal's Malay court names to a jurisdiction code + English label.
function mapCourt(courtMalay = '') {
  const c = courtMalay.toLowerCase();
  if (c.includes('persekutuan')) return { code: 'FC', court: 'Federal Court' };
  if (c.includes('rayuan')) return { code: 'COA', court: 'Court of Appeal' };
  if (c.includes('tinggi')) return { code: 'HC', court: 'High Court' };
  if (c.includes('sesyen')) return { code: 'SC', court: 'Sessions Court' };
  if (c.includes('majistret') || c.includes('magistrate'))
    return { code: 'MC', court: 'Magistrates Court' };
  return { code: 'OTH', court: courtMalay.trim() || 'Court' };
}

const stripTags = (s = '') =>
  String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const aspNetDate = (s) => {
  const m = /\/Date\((\d+)\)\//.exec(s || '');
  return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : null;
};

// "<b>PERAYU</b><br />1.) A<br />2.) B<br /><b>RESPONDEN</b>..." -> readable title.
function parseParties(html = '') {
  const clean = String(html)
    .replace(/<b>/gi, '\n@@')
    .replace(/<\/b>/gi, '@@\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const groups = [];
  let currentLabel = null;
  let names = [];
  for (let line of clean.split('\n')) {
    line = stripTags(line).trim();
    if (!line) continue;
    if (line.startsWith('@@') && line.endsWith('@@')) {
      if (currentLabel) groups.push({ label: currentLabel, names });
      currentLabel = line.replace(/@@/g, '').trim();
      names = [];
    } else if (currentLabel) {
      names.push(line.replace(/^\d+\s*\.?\s*\)?\s*/, '').trim());
    }
  }
  if (currentLabel) groups.push({ label: currentLabel, names });

  const side = (g) => {
    if (!g || !g.names.length) return '';
    const first = g.names[0];
    return g.names.length > 1 ? `${first} & ors` : first;
  };
  const title =
    groups.length >= 2 ? `${side(groups[0])} v ${side(groups[1])}` : stripTags(html);
  return { title, groups };
}

function parseItem(it) {
  const [caseNoRaw, courtRaw] = String(it.CaseNo || '').split(/<br\s*\/?>/i);
  const courtMalay = stripTags((courtRaw || '').replace(/[()]/g, ''));
  const { code, court } = mapCourt(courtMalay);
  const parties = parseParties(it.Parties);
  const coram = String(it.CorumJudge || '')
    .split(/<br\s*\/?>/i).map((x) => stripTags(x)).filter(Boolean);
  const docs = (it.ListOfAPDoc || [])
    .filter((d) => d.DocumentID && !d.IsExpunged)
    .map((d) => ({
      documentId: d.DocumentID,
      name: stripTags(d.APDocName) || 'Judgment',
      preparedBy: stripTags(d.APPreparedBy),
      category: stripTags(d.DecisionCategory),
      pdfUrl: `${PDF_BASE}${d.DocumentID}&Inline=true`,
    }));
  return {
    id: it.eJudgUniqueID || `${code}-${stripTags(caseNoRaw)}`,
    caseNo: stripTags(caseNoRaw),
    jurisdiction: code,
    court,
    title: parties.title,
    parties: parties.groups,
    catchwords: stripTags(it.KeyWord),
    judge: stripTags(it.Judge),
    coram,
    dateOfResult: aspNetDate(it.DateOfResult),
    dateOfFiling: aspNetDate(it.DateOfAP),
    docs,
  };
}

// Load one court's search page, click "Cari", return its 20 latest records.
async function fetchCourt(ctx, code, attempt = 1) {
  const page = await ctx.newPage();
  let result = null;
  try {
    await page.goto(PAGE_URL(code), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const btn = page.locator('input[value="Cari"]');
    await btn.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2500); // let the form's JS finish wiring
    const [res] = await Promise.all([
      page.waitForResponse((r) => /GetEJudgmentPortalSearchList/i.test(r.url()), { timeout: 45000 }),
      btn.click(),
    ]);
    result = (await res.json()).d;
  } catch (e) {
    console.log(`  ${code}: attempt ${attempt} error — ${e.message}`);
  }
  await page.close();
  const items = result?.ListOfSearchItem || [];
  if (!items.length && attempt < 3) {
    console.log(`  ${code}: retrying…`);
    return fetchCourt(ctx, code, attempt + 1);
  }
  console.log(`  ${code}: ${items.length} records (of ${result?.TOTAL_RECORD ?? '?'} total)`);
  return items.map(parseItem);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });

  console.log('Fetching latest judgments per court…');
  const collected = [];
  for (const code of COURT_CODES) {
    collected.push(...(await fetchCourt(ctx, code)));
  }

  await browser.close();

  collected.sort((a, b) => (b.dateOfResult || '').localeCompare(a.dateOfResult || ''));

  // De-dupe by id, keep newest first (already ordered by date desc).
  const seen = new Set();
  const judgments = collected.filter((j) => (seen.has(j.id) ? false : seen.add(j.id)));

  const manifest = {
    source: 'Malaysia E-Judgment Portal (ejudgment.kehakiman.gov.my)',
    updatedAt: new Date().toISOString(),
    count: judgments.length,
    judgments,
  };
  // Write into the app so Metro live-reloads it onto the phone.
  const dataDir = join(OUT_DIR, '..', 'src', 'data');
  mkdirSync(dataDir, { recursive: true });
  const outPath = join(dataDir, 'judgments.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  writeFileSync(join(OUT_DIR, 'judgments.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ Wrote ${judgments.length} judgments → ${outPath}`);
  console.log('Sample:', judgments[0]?.caseNo, '—', judgments[0]?.title);
}

main().catch((e) => {
  console.error('Fetcher failed:', e.message);
  process.exit(1);
});
