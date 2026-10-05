/**
 * ARD — Agentic Resource Discovery catalog for Midman.bd
 *
 * Spec: https://agenticresourcediscovery.org (§4 Entry, §5.1 Discovery,
 * Appendix D.1 formal JSON Schema: ards-project/ard-spec ard-entry.schema.json)
 *
 * Served from:
 *   /.well-known/ard.json           — normative path (§5.1)
 *   /.well-known/ai-catalog.json    — predecessor path (consumers MAY consult)
 *   /ai-catalog.json                — legacy root alias probed by older audits
 *
 * Entry rules enforced by the schema:
 *   - identifier: urn:air:<publisher>:<namespace>:<name>  (publisher = midman.bd)
 *   - displayName, type (IANA media type) required
 *   - exactly one of url / data
 *   - representativeQueries: 2–5 strings (conformance warning if absent)
 */

export const SITE_URL = 'https://midman.bd';
const UPDATED_AT = '2026-09-22T00:00:00+06:00';

type ArdEntry = {
  identifier: string;
  displayName: string;
  type: string;
  url: string;
  description: string;
  tags: string[];
  representativeQueries: string[];
  updatedAt: string;
};

function entry(
  namespace: string,
  name: string,
  displayName: string,
  type: string,
  path: string,
  description: string,
  tags: string[],
  representativeQueries: string[],
): ArdEntry {
  return {
    identifier: `urn:air:midman.bd:${namespace}:${name}`,
    displayName,
    type,
    url: `${SITE_URL}${path}`,
    description,
    tags,
    representativeQueries,
    updatedAt: UPDATED_AT,
  };
}

const HTML = 'text/html';

const ENTRIES: ArdEntry[] = [
  entry(
    'site', 'home',
    'Midman — Escrow Service for Bangladesh',
    HTML, '/',
    'Midman is Bangladesh\'s escrow and P2P transaction platform. Money is held securely until both buyer and seller confirm the deal, protecting both sides of online transactions with bKash, Nagad and Rocket payment support.',
    ['escrow', 'p2p', 'bangladesh', 'secure payments', 'marketplace'],
    [
      'what is Midman and how does escrow work in Bangladesh?',
      'is there a safe way to get paid when selling online in Bangladesh?',
      'how do I complete a secure P2P transaction with a stranger?',
    ],
  ),
  entry(
    'site', 'llms-txt',
    'Midman AI Resource Guide (llms.txt)',
    'text/plain', '/llms.txt',
    'Machine-readable llms.txt guide listing every Midman resource relevant to AI agents and assistants: pages, features, fees, security model and support channels, in a compact plain-text format.',
    ['llms-txt', 'ai-guide', 'documentation', 'agent-resources'],
    [
      'give me a machine-readable summary of the Midman escrow platform',
      'which Midman pages should an AI assistant read to answer user questions?',
    ],
  ),
  entry(
    'docs', 'how-it-works',
    'How Midman Escrow Works',
    HTML, '/how-it-works',
    'Step-by-step guide to the Midman escrow flow: buyer and seller agree on a deal, the buyer pays into escrow, the seller delivers, funds are released after confirmation, and disputes are handled by admin arbitration.',
    ['escrow', 'process', 'buyer protection', 'seller protection'],
    [
      'what are the steps of an escrow transaction on Midman?',
      'when does the seller receive the money on Midman?',
      'what happens if the buyer never confirms delivery?',
    ],
  ),
  entry(
    'docs', 'fees',
    'Midman Escrow Fees & Pricing',
    HTML, '/fees',
    'Complete fee structure for Midman escrow transactions: service charges by deal amount, payment method costs for bKash, Nagad and Rocket, and payout timing, with worked examples.',
    ['fees', 'pricing', 'escrow charges', 'bKash', 'Nagad'],
    [
      'how much does Midman charge in escrow fees?',
      'what are the transaction costs for bKash payments on Midman?',
      'is there a minimum fee for small deals?',
    ],
  ),
  entry(
    'docs', 'security',
    'Midman Security & Data Protection',
    HTML, '/security',
    'How Midman protects funds and data: escrow account controls, verification requirements, fraud detection, dispute resolution and the measures taken to keep payment credentials private.',
    ['security', 'fraud prevention', 'data protection', 'escrow safety'],
    [
      'is Midman safe to use for large transactions?',
      'how does Midman prevent scams and fraud?',
      'what security measures protect my money in escrow?',
    ],
  ),
  entry(
    'docs', 'faq',
    'Midman Frequently Asked Questions',
    HTML, '/faq',
    'Answers to the most common questions about Midman escrow: account setup, deal creation, payment methods, delivery confirmation, refunds, disputes, withdrawals and seller requirements.',
    ['faq', 'support', 'escrow questions'],
    [
      'how do I create my first deal on Midman?',
      'can I get a refund through Midman escrow?',
      'how long do escrow withdrawals take?',
    ],
  ),
  entry(
    'site', 'marketplace',
    'Midman Marketplace',
    HTML, '/marketplace',
    'Browse products and services listed on the Midman marketplace, where every purchase is protected by escrow until the buyer confirms delivery.',
    ['marketplace', 'products', 'escrow shopping', 'bangladesh'],
    [
      'what can I buy on the Midman marketplace?',
      'show me escrow-protected listings in Bangladesh',
    ],
  ),
  entry(
    'site', 'blog',
    'Midman Blog & Updates',
    HTML, '/blog',
    'Announcements, product updates, safety guides and news from the Midman escrow team, including tips for safe online trading in Bangladesh.',
    ['blog', 'updates', 'news', 'trading tips'],
    [
      'what new features has Midman released recently?',
      'where can I read Midman safety guides?',
    ],
  ),
  entry(
    'site', 'about',
    'About Midman',
    HTML, '/about',
    'Background and mission of Midman: why escrow matters for online trade in Bangladesh, who builds the platform, and how the buyer and seller protection model works.',
    ['about', 'company', 'mission'],
    [
      'who operates the Midman escrow platform?',
      'what is Midman\'s mission for online trade in Bangladesh?',
    ],
  ),
  entry(
    'site', 'contact',
    'Contact Midman Support',
    HTML, '/contact',
    'Contact channels for Midman customer support, dispute help, seller onboarding and partnership inquiries.',
    ['contact', 'support', 'customer service'],
    [
      'how do I contact Midman support?',
      'where do I report a scam attempt to Midman?',
    ],
  ),
  entry(
    'site', 'terms',
    'Midman Terms & Privacy',
    HTML, '/terms',
    'Terms of service and privacy policy for the Midman escrow platform: user obligations, escrow agreement, prohibited goods, and how personal and transaction data is collected and stored.',
    ['terms', 'privacy', 'legal', 'policy'],
    [
      'what are the rules for using Midman escrow?',
      'how does Midman handle my personal data?',
    ],
  ),
];

/** The ARD manifest document — shape conforms to ArdManifest in the official schema. */
export function buildArdManifest(): { entries: ArdEntry[] } {
  return { entries: ENTRIES };
}
