import type { BenchmarkCase } from './evaluation.types.js';

/**
 * Built-in Phase 9 benchmark dataset — grounded in `knowledge/*.md`
 * (CloudSync FAQ / handbook / refund policy) so retrieval has a real target
 * when the knowledge index is built. Learning-product friendly: expected
 * answers are returned by `GET /api/v1/evaluation/benchmarks`.
 */
export const BENCHMARK_CASES: readonly BenchmarkCase[] = [
  {
    id: 'faq-password-reset',
    question: 'How do I reset my CloudSync account password?',
    expectedAnswer:
      'Navigate to the login screen, click Forgot Password, enter your registered email, and use the secure token link (valid for 15 minutes). If it expires, request a new one.',
    expectedContextHints: ['Forgot Password', '15 minutes'],
  },
  {
    id: 'faq-free-tier',
    question: 'What are the limits on the Free Tier plan?',
    expectedAnswer:
      'The Free Tier includes up to 5 GB of total cloud storage, a maximum file upload size of 250 MB per file, and an API limit of 100 requests per hour.',
    expectedContextHints: ['5 GB', '250 MB', '100 requests'],
  },
  {
    id: 'faq-sync-403',
    question: 'Why am I seeing a Sync Error 403 message?',
    expectedAnswer:
      'Error 403 indicates an authentication failure, often because the system clock is out of sync with the CloudSync server by more than 5 minutes, or the session token expired. Log out, set the device time to automatic, and log back in.',
    expectedContextHints: ['403', '5 minutes'],
  },
  {
    id: 'faq-share-subscription',
    question: 'Can I share my CloudSync subscription with team members?',
    expectedAnswer:
      'Yes, but only on Pro or Enterprise. Individual is limited to one concurrent login. Pro allows up to 5 team members; Enterprise supports unlimited users with RBAC.',
    expectedContextHints: ['Pro', 'Enterprise', '5 team'],
  },
  {
    id: 'refund-window',
    question: 'What is the standard return window for Apex Retail purchases?',
    expectedAnswer:
      'Customers may return items within 30 days of the original purchase date for a full refund to the original payment method, subject to condition categories in the refund policy.',
    expectedContextHints: ['30 days', 'refund'],
  },
  {
    id: 'handbook-pto',
    question: 'How much accrued PTO does Acme Corp offer annually?',
    expectedAnswer:
      'Acme Corp offers 20 days of Accrued PTO annually, calculated at a rate of 1.66 days per month. A maximum of 5 unused PTO days can roll over into the next calendar year.',
    expectedContextHints: ['20 days', '1.66', 'PTO'],
  },
  {
    id: 'faq-api-limit',
    question: 'What is the Free Tier API request limit per hour?',
    expectedAnswer: 'The Free Tier has an API limit of 100 requests per hour.',
    expectedContextHints: ['100 requests'],
  },
  {
    id: 'faq-upload-size',
    question: 'What is the maximum file upload size on the Free Tier?',
    expectedAnswer: 'The Free Tier allows a maximum file upload size of 250 MB per file.',
    expectedContextHints: ['250 MB'],
  },
];

export function listBenchmarkCases(): readonly BenchmarkCase[] {
  return BENCHMARK_CASES;
}

export function resolveBenchmarkCases(caseIds?: readonly string[]): BenchmarkCase[] {
  if (!caseIds || caseIds.length === 0) {
    return [...BENCHMARK_CASES];
  }

  const byId = new Map(BENCHMARK_CASES.map((item) => [item.id, item]));
  const resolved: BenchmarkCase[] = [];
  for (const id of caseIds) {
    const found = byId.get(id);
    if (found) resolved.push(found);
  }
  return resolved;
}
