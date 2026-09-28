'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareSnapshot, rssEvidenceRole } = require('./prepare-editorial-snapshot.cjs');

function artifact(overrides = {}) {
  return {
    shanghaiDate: '2026-09-24',
    collectedAt: '2026-09-23T23:20:00.000Z',
    sourceHealth: { schemaVersion: 1, status: 'degraded', counts: { success: 3 }, sources: [{}, {}, {}] },
    github: [{ repo: 'owner/repo', releases: [{ name: 'v2', url: 'https://github.com/owner/repo/releases/v2', publishedAt: '2026-09-23T22:00:00Z' }], commits: [{ message: 'ship it', url: 'https://github.com/owner/repo/commit/1', date: '2026-09-23T21:00:00Z' }] }],
    huggingface: [{ org: 'owner', models: [{ id: 'owner/model', url: 'https://huggingface.co/owner/model', lastModified: '2026-09-23T20:00:00Z' }] }],
    rss: [{ id: 'feed', url: 'https://mirror.example/feed.xml', kind: 'mirror', evidenceRole: 'discovery-only', region: 'Global', items: [{ title: 'duplicate release', url: 'https://github.com/owner/repo/releases/v2', date: '2026-09-23T22:00:00Z' }, { title: 'mirrored lead', url: 'https://example.com/lead', date: '2026-09-23T23:00:00Z' }, { title: '', url: 'https://example.com/empty' }] }],
    ...overrides,
  };
}

test('normalizes valid candidates and deduplicates URLs', () => {
  const snapshot = prepareSnapshot(artifact(), {
    targetDate: '2026-09-24', now: new Date('2026-09-23T23:40:00Z'), maxAgeMinutes: 180,
  });
  assert.equal(snapshot.candidateCount, 4);
  assert.deepEqual(snapshot.candidates.map((item) => item.sourceType), ['github-release', 'github-commit', 'huggingface-model', 'rss-item']);
  assert.equal(new Set(snapshot.candidates.map((item) => item.id)).size, snapshot.candidateCount);
  assert.deepEqual(snapshot.candidates.at(-1), {
    id: snapshot.candidates.at(-1).id,
    title: 'mirrored lead',
    url: 'https://example.com/lead',
    publishedAt: '2026-09-23T23:00:00Z',
    sourceType: 'rss-item',
    sourceId: 'feed',
    sourceKind: 'mirror',
    evidenceRole: 'discovery-only',
    feedUrl: 'https://mirror.example/feed.xml',
    sourceRegion: 'Global',
  });
  assert.equal(snapshot.ageMinutes, 20);
  assert.equal(snapshot.artifactHealth.totalSources, 3);
});

test('rejects stale, wrong-date and failed artifacts', () => {
  assert.throws(() => prepareSnapshot(artifact(), {
    targetDate: '2026-09-24', now: new Date('2026-09-24T04:00:01Z'), maxAgeMinutes: 180,
  }), /stale/);
  assert.throws(() => prepareSnapshot(artifact(), {
    targetDate: '2026-09-25', now: new Date('2026-09-23T23:40:00Z'), maxAgeMinutes: 180,
  }), /does not match/);
  assert.throws(() => prepareSnapshot(artifact({ sourceHealth: { schemaVersion: 1, status: 'failed' } }), {
    targetDate: '2026-09-24', now: new Date('2026-09-23T23:40:00Z'), maxAgeMinutes: 180,
  }), /health is failed/);
});

test('classifies RSS feeds by evidence role without promoting mirrors', () => {
  assert.equal(rssEvidenceRole('official'), 'primary-publisher');
  assert.equal(rssEvidenceRole('press'), 'secondary-press');
  assert.equal(rssEvidenceRole('community'), 'discovery-lead');
  assert.equal(rssEvidenceRole('mirror'), 'mirror-lead');
});
