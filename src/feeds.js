import { XMLParser } from 'fast-xml-parser';

// Public news RSS feeds we pull from. Add/remove freely.
// jurisdiction: 'MY' | 'UK'.  legalSource: feed is already law-only, so
// skip the legal-keyword filter for its items (keeps genuine law stories in).
export const SOURCES = [
  { name: 'Free Malaysia Today', url: 'https://www.freemalaysiatoday.com/feed/', jurisdiction: 'MY' },
  { name: 'Malay Mail', url: 'https://www.malaymail.com/feed/rss/malaysia', jurisdiction: 'MY' },
  { name: 'The Guardian · Law', url: 'https://www.theguardian.com/law/rss', jurisdiction: 'UK', legalSource: true },
  { name: 'UK Human Rights Blog', url: 'https://ukhumanrightsblog.com/feed/', jurisdiction: 'UK', legalSource: true },
];

export const JURISDICTIONS = {
  MY: { label: 'Malaysia', flag: '🇲🇾' },
  UK: { label: 'UK', flag: '🇬🇧' },
};

// Words that mark a story as legal-relevant. Used to filter general news
// down to court / law items. Kept lowercase; matched against title+summary.
const LEGAL_KEYWORDS = [
  'court', 'judge', 'judgment', 'judgement', 'ruling', 'verdict', 'tribunal',
  'federal court', 'court of appeal', 'high court', 'sessions court', 'magistrate',
  'lawsuit', 'litigation', 'sued', 'sue ', 'suit', 'plaintiff', 'defendant',
  'charged', 'acquitt', 'convict', 'sentence', 'bail', 'appeal', 'prosecut',
  'attorney-general', 'agc', 'bar council', 'constitutional', 'defamation',
  'injunction', 'legal', 'law ', 'statute', 'legislation', 'contempt',
  'remand', 'jailed', 'fined', 'trial', 'hearing', 'apex court',
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Turn a raw <description>/<content> blob into clean preview text.
function stripHtml(html = '') {
  return String(html)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstImage(item) {
  // Try common RSS image locations.
  const media = item['media:content'] || item['media:thumbnail'];
  if (media && media['@_url']) return media['@_url'];
  if (Array.isArray(media) && media[0]?.['@_url']) return media[0]['@_url'];
  const enc = item.enclosure;
  if (enc && enc['@_url'] && /image/i.test(enc['@_type'] || '')) return enc['@_url'];
  const html = item['content:encoded'] || item.description || '';
  const m = String(html).match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function isLegal(text) {
  const t = text.toLowerCase();
  return LEGAL_KEYWORDS.some((k) => t.includes(k));
}

// Fetch and parse a single feed. Returns [] on any failure so one bad
// source never breaks the whole screen.
async function fetchOne(source) {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (LegalPulse RSS reader)' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const data = parser.parse(xml);
    let items = data?.rss?.channel?.item ?? data?.feed?.entry ?? [];
    if (!Array.isArray(items)) items = [items];

    return items.map((it, i) => {
      const title = stripHtml(it.title?.['#text'] ?? it.title ?? 'Untitled');
      const link =
        typeof it.link === 'string'
          ? it.link
          : it.link?.['@_href'] ?? it.link?.['#text'] ?? it.guid?.['#text'] ?? it.guid ?? '';
      const summary = stripHtml(it.description ?? it.summary ?? it['content:encoded'] ?? '');
      const pubDate = it.pubDate ?? it.published ?? it.updated ?? null;
      return {
        id: `${source.name}-${i}-${link}`,
        source: source.name,
        jurisdiction: source.jurisdiction,
        legalSource: !!source.legalSource,
        title,
        link: String(link),
        summary: summary.slice(0, 240),
        image: firstImage(it),
        pubDate,
        ts: pubDate ? Date.parse(pubDate) || 0 : 0,
      };
    });
  } catch (e) {
    return [];
  }
}

// Fetch every source in parallel, merge, sort newest-first.
// legalOnly=true filters general feeds down to court/law stories (law-only
// feeds are always kept). jurisdiction='MY'|'UK'|'ALL' filters by country.
export async function fetchNews(legalOnly = true, jurisdiction = 'ALL') {
  const active =
    jurisdiction === 'ALL' ? SOURCES : SOURCES.filter((s) => s.jurisdiction === jurisdiction);
  const all = (await Promise.all(active.map(fetchOne))).flat();
  const filtered = legalOnly
    ? all.filter((a) => a.legalSource || isLegal(`${a.title} ${a.summary}`))
    : all;
  filtered.sort((a, b) => b.ts - a.ts);
  return filtered;
}
