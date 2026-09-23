#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCollectorHealth, classifyError, fetchWithPolicy, mapConcurrent } = require('./collect-signals.cjs');

test('classifies common collector failures without hiding rate limits or timeouts', () => {
  assert.equal(classifyError('HTTP 429 rate limit exceeded'), 'rate_limited');
  assert.equal(classifyError('AbortError: request timed out'), 'timeout');
  assert.equal(classifyError('Unexpected token in JSON'), 'parse_error');
  assert.equal(classifyError('HTTP 403'), 'access_denied');
  assert.equal(classifyError('HTTP 503'), 'upstream_error');
});

test('reports partial, empty, failed and optional skipped sources separately', () => {
  const observedAt = '2026-09-23T09:00:00.000Z';
  const result = buildCollectorHealth({
    github: [
      { repo: 'org/partial', releases: [], commits: { error: 'HTTP 429' } },
      { repo: 'org/empty', releases: [], commits: [] },
    ],
    huggingface: [{ org: 'broken', error: 'request timed out' }],
    rss: [{ id: 'optional', optional: true, skipped: 403 }],
    durations: {
      'github:org/partial': 12,
      'github:org/empty': 8,
      'huggingface:broken': 30001,
      'rss:optional': 30,
    },
    previous: { 'huggingface:broken': '2026-09-22T01:00:00.000Z' },
  }, observedAt);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.counts, { success: 0, partial: 1, empty: 1, failed: 1, skipped: 1 });
  assert.equal(result.sources[0].errorType, 'rate_limited');
  assert.equal(result.sources[2].errorType, 'timeout');
  assert.equal(result.sources[2].lastSuccessAt, '2026-09-22T01:00:00.000Z');
  assert.equal(result.sources[3].status, 'skipped');
});

test('all actionable failures cannot be reported as healthy', () => {
  const result = buildCollectorHealth({
    github: [{ repo: 'org/down', releases: { error: 'HTTP 503' }, commits: { error: 'HTTP 503' } }],
    huggingface: [],
    rss: [],
  }, '2026-09-23T09:00:00.000Z');
  assert.equal(result.status, 'failed');
  assert.equal(result.counts.failed, 1);
  assert.equal(result.sources[0].lastSuccessAt, null);
});

test('a partial endpoint with no usable items still makes the run fail closed', () => {
  const result = buildCollectorHealth({
    github: [{ repo: 'org/empty-partial', releases: [], commits: { error: 'HTTP 503' } }],
    huggingface: [],
    rss: [],
  }, '2026-09-23T09:00:00.000Z');
  assert.equal(result.sources[0].status, 'partial');
  assert.equal(result.sources[0].itemCount, 0);
  assert.equal(result.status, 'failed');
});

test('successful sources record item counts, duration and current success time', () => {
  const observedAt = '2026-09-23T09:00:00.000Z';
  const result = buildCollectorHealth({
    github: [{ repo: 'org/repo', releases: [{ tag: 'v1' }], commits: [{ sha: 'abc' }] }],
    huggingface: [{ org: 'model-org', models: [{ id: 'model-org/m' }] }],
    rss: [{ id: 'feed', items: [{ title: 'news' }] }],
    durations: { 'github:org/repo': 5, 'huggingface:model-org': 6, 'rss:feed': 7 },
  }, observedAt);
  assert.equal(result.status, 'healthy');
  assert.deepEqual(result.sources.map((source) => source.itemCount), [2, 1, 1]);
  assert.deepEqual(result.sources.map((source) => source.durationMs), [5, 6, 7]);
  assert.ok(result.sources.every((source) => source.lastSuccessAt === observedAt));
});

test('network policy retries rate limits and eventually returns parsed content', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls < 3) return { ok: false, status: 429, text: async () => 'slow down' };
    return { ok: true, status: 200, text: async () => '{"ok":true}' };
  };
  const result = await fetchWithPolicy('https://example.org/data', {}, {
    attempts: 3,
    timeoutMs: 100,
    fetchImpl,
    sleep: async () => {},
    parse: async (response) => JSON.parse(await response.text()),
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(calls, 3);
});

test('network policy does not retry non-rate-limit 4xx responses', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: false, status: 403, text: async () => 'forbidden' };
  };
  await assert.rejects(fetchWithPolicy('https://example.org/private', {}, {
    attempts: 3,
    timeoutMs: 100,
    fetchImpl,
    sleep: async () => {},
  }), /HTTP 403/);
  assert.equal(calls, 1);
});

test('network policy aborts a hung request and retries only the configured number of times', async () => {
  let calls = 0;
  const fetchImpl = async (_url, { signal }) => {
    calls++;
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
    });
  };
  await assert.rejects(fetchWithPolicy('https://example.org/hang', {}, {
    attempts: 2,
    timeoutMs: 5,
    fetchImpl,
    sleep: async () => {},
  }), /aborted/);
  assert.equal(calls, 2);
});

test('controlled concurrency preserves source order and respects the limit', async () => {
  let active = 0;
  let maximum = 0;
  const values = await mapConcurrent([1, 2, 3, 4, 5], 2, async (value) => {
    active++;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, value % 2 ? 3 : 1));
    active--;
    return value * 10;
  });
  assert.deepEqual(values, [10, 20, 30, 40, 50]);
  assert.equal(maximum, 2);
});
