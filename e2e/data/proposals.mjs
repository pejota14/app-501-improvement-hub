import { randomUUID } from 'node:crypto';

export function createProposal({ area = 'engineering', expectedImpact = 'high' } = {}) {
  const identifier = randomUUID();
  return {
    name: `Demo ${identifier.slice(0, 8)}`,
    email: `qa-${identifier}@example.com`,
    area,
    title: `Improve build feedback ${identifier}`,
    description: 'Cache unchanged bundles to shorten continuous integration feedback.',
    expectedImpact,
  };
}