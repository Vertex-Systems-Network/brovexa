import { createHash } from 'node:crypto';
import type { WebsiteExtraction } from './website-inspection-runtime';

/**
 * M04-WEB-004: Conservative deterministic analysis of ONE trusted test fixture.
 * This is NOT a browser, general HTML parser, transport attestation or live fetcher.
 * Source page bytes are transient and NEVER returned or persisted.
 * Positive evidence refs are non-reversible fixture fingerprints, not third-party
 * verification. Missing capabilities are UNKNOWN, never negative findings.
 */
export class WebsiteFixtureExtractionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'WebsiteFixtureExtractionError';
  }
}

const CAPABILITIES = [
  'booking', 'commerce', 'contact_form', 'business_contact',
  'mobile_viewport', 'structured_data', 'social_link', 'https',
] as const;
type Capability = typeof CAPABILITIES[number];
// The HTML parser needs only byte budget and verified canonical root, not a
// test-only request. A separately authorized v2 live read may reuse the same
// conservative HTML logic without forging a v1 test-only result.
type ExtractionInput = {
  readonly request: { readonly verifiedDomain: string; readonly targetUrl: string;
    readonly limits: { readonly maxResponseBytes: number } };
  readonly body: Uint8Array;
  readonly receiptId: string;
};
// A conservative static fixture parser must ignore evidence in intentionally
// inert or invisible HTML. This is not an attempt at computed-CSS rendering.
const inertTextTags = new Set([
  'script', 'style', 'template', 'textarea', 'noscript', 'iframe',
  // HTML raw-text / RCDATA and legacy elements can contain literal '<a>'
  // and '<meta>' strings that are not rendered child nodes.
  'title', 'xmp', 'listing', 'noembed', 'noframes',
]);
const voidTags = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
function concealed(attrs: Readonly<Record<string, string>>, tagName: string): boolean {
  const css = attrs.style ?? '';
  return 'hidden' in attrs || 'inert' in attrs ||
    (tagName === 'fieldset' && 'disabled' in attrs) ||
    attrs['aria-hidden']?.trim().toLowerCase() === 'true' ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\.0+)?(?:%)?)(?:\s*!important)?\s*(?:;|$)/i.test(css);
}

// Defense in depth: byte budgets alone permit hundreds of thousands of tiny
// tags in a synthetic page, so bound parser work independently of response size.
const MAX_FIXTURE_TAGS = 20_000;
const socialDomains = new Set([
  'instagram.com', 'facebook.com', 'linkedin.com', 'youtube.com',
  'youtu.be', 'x.com', 'twitter.com', 'tiktok.com',
]);

function hashEvidence(receipt: string, capability: Capability, observed: string): string {
  return `fixture.${createHash('sha256').update(JSON.stringify([
    'm04-website-fixture-evidence-v1', receipt, capability, observed,
  ])).digest('hex').slice(0, 40)}`;
}

function attributes(tag: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = Object.create(null) as Record<string, string>;
  // Parse quoted/unquoted HTML attributes. Do not execute inline events/scripts.
  const offset = /^<\s*\/?\s*[a-z][a-z0-9:-]*/i.exec(tag)?.[0].length;
  if (!offset) return result;
  const text = tag.slice(offset, -1);
  const attrPattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(text)) !== null) {
    const name = match[1]?.toLowerCase();
    if (name && !(name in result)) result[name] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function tagsOf(html: string): Array<{ name: string; closing: boolean; text: string; attrs: Readonly<Record<string, string>> }> {
  const tags: Array<{ name: string; closing: boolean; text: string; attrs: Readonly<Record<string, string>> }> = [];
  // Scan with quotation awareness: `>` inside an attribute is not a tag end.
  // Only explicit tags are inspected; content in comments, scripts, styles and
  // templates is never interpreted as HTML elements.
  let i = 0;
  let raw: string | null = null;
  while (i < html.length) {
    if (raw) {
      const closePattern = new RegExp(`<\\s*\\/\\s*${raw}\\s*>`, 'ig');
      closePattern.lastIndex = i;
      const match = closePattern.exec(html);
      if (!match) break;
      if (tags.length >= MAX_FIXTURE_TAGS) {
        throw new WebsiteFixtureExtractionError('M04_FIXTURE_TAG_BUDGET');
      }
      tags.push({ name: raw, closing: true, text: match[0], attrs: Object.create(null) as Record<string, string> });
      i = closePattern.lastIndex;
      raw = null;
      continue;
    }
    const start = html.indexOf('<', i);
    if (start < 0) break;
    // HTML CDATA-like declarations are not evidence-bearing HTML elements.
    // Treat their contents as inert (including any apparent nested tags).
    if (html.slice(start, start + 9).toLowerCase() === '<![cdata[') {
      const end = html.indexOf(']]>', start + 9);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      if (end < 0) break;
      i = end + 3;
      continue;
    }
    let end = start + 1;
    let quote: string | null = null;
    for (; end < html.length && end < start + 4096; end++) {
      const char = html[end];
      if (quote) { if (char === quote) quote = null; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (html[end] !== '>' || quote !== null) {
      i = end + 1;
      continue;
    }
    const rawTag = html.slice(start, end + 1);
    i = end + 1;
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i.exec(rawTag);
    if (!parsed) continue;
    const closing = parsed[1] === '/';
    const name = (parsed[2] ?? '').toLowerCase();
    const attrs = closing ? (Object.create(null) as Record<string, string>) : attributes(rawTag);
    if (tags.length >= MAX_FIXTURE_TAGS) {
      throw new WebsiteFixtureExtractionError('M04_FIXTURE_TAG_BUDGET');
    }
    tags.push({ name, closing, text: rawTag, attrs });
    if (!closing && name === 'plaintext') {
      // HTML plaintext consumes the rest of the document; even a lexical
      // </plaintext> sequence must never re-enable fixture evidence scanning.
      break;
    }
    if (!closing && inertTextTags.has(name)) raw = name;
  }
  return tags;
}

function safeSocialHref(raw: string | undefined): boolean {
  if (!raw || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      (socialDomains.has(host) || (host.startsWith('www.') && socialDomains.has(host.slice(4))));
  } catch { return false; }
}

/**
 * Returns only explicitly grounded fixture observations, and always partial
 * coverage even if all eight feature kinds are observed in the home page.
 * Single-page inspection cannot imply full-site absence.
 */
export async function extractWebsiteCapabilitiesFromFixture(
  input: ExtractionInput,
): Promise<WebsiteExtraction> {
  if (!(input?.body instanceof Uint8Array) ||
      !Number.isSafeInteger(input.request.limits.maxResponseBytes) ||
      input.body.byteLength > input.request.limits.maxResponseBytes ||
      input.body.byteLength > 1_000_000) {
    throw new WebsiteFixtureExtractionError('M04_FIXTURE_EXTRACT_BYTE_BUDGET');
  }
  if (typeof input.receiptId !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(input.receiptId)) {
    throw new WebsiteFixtureExtractionError('M04_FIXTURE_EXTRACT_RECEIPT_INVALID');
  }
  let html: string;
  try { html = new TextDecoder('utf-8', { fatal: true }).decode(input.body); }
  catch { throw new WebsiteFixtureExtractionError('M04_FIXTURE_EXTRACT_ENCODING_INVALID'); }
  const found = new Map<Capability, string>();
  const tags = tagsOf(html);
  let form: { emailTag: string | null; messageTag: string | null; started: string } | null = null;
  const suppressed: string[] = [];
  for (const tag of tags) {
    // Track every nested element while hidden; mismatched close tags cannot
    // prematurely reveal social/form claims inside an inert ancestor.
    if (suppressed.length > 0) {
      if (tag.closing) {
        if (suppressed[suppressed.length - 1] === tag.name) suppressed.pop();
      } else if (!voidTags.has(tag.name) && !/\/\s*>$/.test(tag.text)) {
        suppressed.push(tag.name);
      }
      continue;
    }
    if (!tag.closing && concealed(tag.attrs, tag.name)) {
      if (!voidTags.has(tag.name) && !/\/\s*>$/.test(tag.text)) {
        suppressed.push(tag.name);
      }
      continue;
    }
    if (tag.name === 'form') {
      if (!tag.closing) {
        form = { emailTag: null, messageTag: null, started: tag.text };
      } else {
        if (form?.emailTag && form.messageTag && !found.has('contact_form')) {
          found.set('contact_form', JSON.stringify([form.started, form.emailTag, form.messageTag]));
        }
        form = null;
      }
      continue;
    }
    if (tag.closing) continue;
    if (tag.name === 'input' && form && !('disabled' in tag.attrs) &&
        !('hidden' in tag.attrs) && tag.attrs.type?.toLowerCase() !== 'hidden' &&
        (tag.attrs.type?.toLowerCase() === 'email' ||
          ((!tag.attrs.type || ['text', 'email'].includes(tag.attrs.type.toLowerCase())) &&
           tag.attrs.name?.toLowerCase() === 'email'))) {
      form.emailTag = tag.text;
    }
    if (tag.name === 'textarea' && form && !('disabled' in tag.attrs) &&
        !('hidden' in tag.attrs)) form.messageTag = tag.text;
    if (tag.name === 'meta' && tag.attrs.name?.toLowerCase() === 'viewport' &&
        /(?:^|[,;\s])width\s*=\s*device-width(?:[,;\s]|$)/i.test(tag.attrs.content ?? '')) {
      if (!found.has('mobile_viewport')) found.set('mobile_viewport', tag.text);
    }
    if (tag.name === 'a' && safeSocialHref(tag.attrs.href)) {
      if (!found.has('social_link')) found.set('social_link', tag.text);
    }
    // Do not claim structured_data from a script tag alone: its JSON content
    // has not been parsed or bound to schema.org. Leave it UNKNOWN.
  }
  // HTTPS is grounded in the admitted canonical target URL + transport receipt,
  // not a claim about SSL configuration beyond this one fixture exchange.
  if (input.request.targetUrl === `https://${input.request.verifiedDomain}/`) {
    found.set('https', input.request.targetUrl);
  }
  return {
    coverage: 'partial',
    reasonCodes: ['website.single_page_only'],
    findings: CAPABILITIES.map(capability => {
      const evidence = found.get(capability);
      return evidence === undefined
        ? { capability, observation: 'unknown' as const, reason: 'insufficient_evidence' as const,
            confidence: null, evidenceReferenceIds: [] }
        : { capability, observation: 'observed_present' as const, reason: 'detected' as const,
            confidence: 0.8, evidenceReferenceIds: [hashEvidence(input.receiptId, capability, evidence)] };
    }),
  };
}