#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parseArgs, writeUtf8 } = require('./lib/io.cjs');

function assertValidArtifact(artifact, { targetDate, now = new Date(), maxAgeMinutes = 180 }) {
  if (!artifact || typeof artifact !== 'object') throw new Error('collector artifact must be an object');
  if (artifact.shanghaiDate !== targetDate) {
    throw new Error(`collector date ${artifact.shanghaiDate || 'missing'} does not match ${targetDate}`);
  }
  const collectedAt = new Date(artifact.collectedAt);
  if (!Number.isFinite(collectedAt.getTime())) throw new Error('collector collectedAt is invalid');
  const ageMinutes = (now.getTime() - collectedAt.getTime()) / 60000;
  if (ageMinutes < -5) throw new Error('collector artifact is from the future');
  if (ageMinutes > maxAgeMinutes) {
    throw new Error(`collector artifact is stale (${Math.round(ageMinutes)} minutes old)`);
  }
  if (artifact.sourceHealth?.schemaVersion !== 1) throw new Error('collector health schemaVersion 1 is required');
  if (artifact.sourceHealth?.status === 'failed') throw new Error('collector health is failed');
  return { collectedAt: collectedAt.toISOString(), ageMinutes: Math.max(0, Math.round(ageMinutes)) };
}

function candidateId(sourceType, sourceId, url) {
  return crypto.createHash('sha256').update(`${sourceType}:${sourceId}:${url}`).digest('hex').slice(0, 24);
}

function canonicalizeCandidateUrl(input) {
  const url = new URL(String(input || '').trim());
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_[a-z]+|ref|source|campaign)$/i.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function buildCandidate({ sourceType, sourceId, title, url, publishedAt, sourceTimestamp, sourceTimestampType, sourceKind, evidenceRole, feedUrl, sourceRegion }) {
  const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim();
  const cleanUrl = String(url || '').trim();
  if (!cleanTitle || !/^https:\/\//i.test(cleanUrl)) return null;
  const canonicalUrl = canonicalizeCandidateUrl(cleanUrl);
  return {
    id: candidateId(sourceType, sourceId, canonicalUrl),
    eventKey: crypto.createHash('sha256').update(`event:${canonicalUrl}`).digest('hex').slice(0, 24),
    title: cleanTitle,
    url: cleanUrl,
    canonicalUrl,
    publishedAt: publishedAt || null,
    sourceTimestamp: sourceTimestamp || publishedAt || null,
    sourceTimestampType: sourceTimestampType || (publishedAt ? 'published' : 'unknown'),
    sourceType,
    sourceId,
    sourceKind,
    evidenceRole,
    ...(feedUrl ? { feedUrl } : {}),
    ...(sourceRegion ? { sourceRegion } : {}),
  };
}

function rssEvidenceRole(kind) {
  return ({
    official: 'primary-publisher',
    product: 'primary-publisher',
    research: 'primary-research-index',
    analysis: 'secondary-analysis',
    press: 'secondary-press',
    community: 'discovery-lead',
    'new-site': 'discovery-lead',
    mirror: 'mirror-lead',
  })[kind] || 'unclassified-lead';
}

function flattenCandidates(artifact) {
  const candidates = [];
  for (const repo of artifact.github || []) {
    for (const release of Array.isArray(repo.releases) ? repo.releases : []) {
      candidates.push(buildCandidate({
        sourceType: 'github-release', sourceId: repo.repo,
        title: release.name || release.tag, url: release.url, publishedAt: release.publishedAt,
        sourceTimestamp: release.publishedAt, sourceTimestampType: 'published',
        sourceKind: 'repository', evidenceRole: 'primary-release',
      }));
    }
    for (const commit of Array.isArray(repo.commits) ? repo.commits : []) {
      candidates.push(buildCandidate({
        sourceType: 'github-commit', sourceId: repo.repo,
        title: commit.message, url: commit.url,
        sourceTimestamp: commit.date, sourceTimestampType: 'commit-authored',
        sourceKind: 'repository', evidenceRole: 'primary-change',
      }));
    }
  }
  for (const org of artifact.huggingface || []) {
    for (const model of Array.isArray(org.models) ? org.models : []) {
      candidates.push(buildCandidate({
        sourceType: 'huggingface-model', sourceId: org.org,
        title: model.id, url: model.url,
        sourceTimestamp: model.lastModified, sourceTimestampType: 'last-modified',
        sourceKind: 'model-hub', evidenceRole: 'primary-model-card',
      }));
    }
  }
  for (const feed of artifact.rss || []) {
    for (const item of Array.isArray(feed.items) ? feed.items : []) {
      candidates.push(buildCandidate({
        sourceType: 'rss-item', sourceId: feed.id,
        title: item.title, url: item.url,
        sourceTimestamp: item.date, sourceTimestampType: 'feed-declared',
        sourceKind: feed.kind || 'unspecified',
        evidenceRole: feed.evidenceRole || rssEvidenceRole(feed.kind),
        feedUrl: feed.url,
        sourceRegion: feed.region,
      }));
    }
  }
  const seen = new Set();
  return candidates.filter(Boolean).filter((candidate) => {
    if (seen.has(candidate.canonicalUrl)) return false;
    seen.add(candidate.canonicalUrl);
    return true;
  });
}

function prepareSnapshot(artifact, options) {
  const freshness = assertValidArtifact(artifact, options);
  const candidates = flattenCandidates(artifact).map((candidate) => ({
    ...candidate,
    observedAt: freshness.collectedAt,
  }));
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    throw new Error('collector candidate IDs are not unique');
  }
  return {
    schemaVersion: 1,
    sourceTaxonomyVersion: 1,
    targetDate: options.targetDate,
    collectedAt: freshness.collectedAt,
    preparedAt: (options.now || new Date()).toISOString(),
    ageMinutes: freshness.ageMinutes,
    artifactHealth: {
      status: artifact.sourceHealth.status,
      counts: artifact.sourceHealth.counts || {},
      totalSources: Array.isArray(artifact.sourceHealth.sources) ? artifact.sourceHealth.sources.length : 0,
    },
    candidateCount: candidates.length,
    candidates,
    provenance: options.provenance || { kind: 'collector-artifact' },
  };
}

function main() {
  const args = parseArgs();
  if (!args.artifact || !args.date || !args.out) {
    throw new Error('usage: prepare-editorial-snapshot.cjs --artifact FILE --date YYYY-MM-DD --out FILE');
  }
  const artifact = JSON.parse(fs.readFileSync(path.resolve(args.artifact), 'utf8'));
  const now = args.now ? new Date(args.now) : new Date();
  const snapshot = prepareSnapshot(artifact, {
    targetDate: args.date,
    now,
    maxAgeMinutes: Number(args['max-age-minutes'] || 180),
    provenance: {
      kind: args['provenance-kind'] || 'collector-artifact',
      ...(args['run-id'] ? { runId: Number(args['run-id']) } : {}),
      ...(args['head-sha'] ? { headSha: args['head-sha'] } : {}),
    },
  });
  writeUtf8(path.resolve(args.out), `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ status: 'prepared', candidateCount: snapshot.candidateCount, collectedAt: snapshot.collectedAt })}\n`);
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { assertValidArtifact, canonicalizeCandidateUrl, flattenCandidates, prepareSnapshot, rssEvidenceRole };
