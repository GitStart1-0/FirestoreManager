import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {createRegistryHandler} from './server';

const fixture = path.resolve('tmp/registry-server-test.json');
test.before(async () => { await fs.mkdir(path.dirname(fixture), {recursive: true}); await fs.writeFile(fixture, JSON.stringify({schemaVersion: 1, generatedAt: '2026-01-01T00:00:00Z', sources: [{source: 'MYTHOS', records: 1}], usages: [{source: 'MYTHOS', sourceId: 'q1', terms: ['Ефект Мпемби'], disciplines: ['physics'], sourceFile: 'l3.json'}]})); });

test('public API requires bearer auth and remains read-only', async () => {
  const handler = await createRegistryHandler({snapshotPath: fixture, apiKey: 'test-secret', requireApiKey: true, rateLimitPerMinute: 20});
  const server = createServer((request, response) => handler(request, response)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert(address && typeof address === 'object'); const base = `http://127.0.0.1:${address.port}`;
  assert.equal((await fetch(`${base}/v1/search?q=Мпемби`)).status, 401);
  assert.equal((await fetch(`${base}/v1/search?q=Мпемби`, {headers: {authorization: 'Bearer test-secret'}})).status, 200);
  assert.equal((await fetch(`${base}/v1/search?q=Мпемби`, {method: 'POST', headers: {authorization: 'Bearer test-secret'}})).status, 405);
  server.close(); await once(server, 'close');
});
