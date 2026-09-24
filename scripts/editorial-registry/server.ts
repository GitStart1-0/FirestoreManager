import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {searchRegistry} from '../../src/editorialRegistry/search';
import {RegistrySnapshot} from '../../src/editorialRegistry/types';

const snapshotPath = path.resolve(process.env.REGISTRY_PATH ?? 'content-registry/generated/registry.json');
const port = Number(process.env.REGISTRY_PORT ?? 4317);

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': process.env.REGISTRY_ALLOWED_ORIGIN ?? 'http://localhost:3000',
  });
  response.end(JSON.stringify(body));
}

async function loadSnapshot(): Promise<RegistrySnapshot> {
  return JSON.parse(await fs.readFile(snapshotPath, 'utf8')) as RegistrySnapshot;
}

const openApi = {
  openapi: '3.1.0',
  info: {title: 'Mythos Editorial Registry', version: '1.0.0'},
  paths: {
    '/v1/search': {
      get: {
        operationId: 'searchEditorialRegistry',
        summary: 'Search existing Mythos terms and local external-dataset snapshots',
        parameters: [
          {name: 'q', in: 'query', required: true, schema: {type: 'string'}},
          {name: 'sources', in: 'query', schema: {type: 'string'}, description: 'Comma-separated source names'},
          {name: 'limit', in: 'query', schema: {type: 'integer', minimum: 1, maximum: 100}},
        ],
        responses: {'200': {description: 'Read-only search results'}},
      },
    },
    '/v1/coverage': {
      get: {operationId: 'getEditorialCoverage', summary: 'Count records and disciplines', responses: {'200': {description: 'Coverage summary'}}},
    },
  },
};

async function handler(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== 'GET') return json(response, 405, {error: 'read_only_api'});
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname === '/openapi.json') return json(response, 200, openApi);
  const snapshot = await loadSnapshot();
  if (url.pathname === '/health') return json(response, 200, {status: 'ok', generatedAt: snapshot.generatedAt});
  if (url.pathname === '/v1/search') {
    const query = url.searchParams.get('q') ?? '';
    if (!query.trim()) return json(response, 400, {error: 'q_required'});
    return json(response, 200, {
      query,
      results: searchRegistry(snapshot, query, {
        sources: url.searchParams.get('sources')?.split(',').filter(Boolean),
        limit: Number(url.searchParams.get('limit') ?? 20),
      }),
    });
  }
  if (url.pathname === '/v1/coverage') {
    const disciplines: Record<string, number> = {};
    snapshot.usages.flatMap(usage => usage.disciplines).forEach(item => disciplines[item] = (disciplines[item] ?? 0) + 1);
    return json(response, 200, {generatedAt: snapshot.generatedAt, sources: snapshot.sources, disciplines});
  }
  return json(response, 404, {error: 'not_found'});
}

createServer((request, response) => handler(request, response).catch(error => {
  console.error(error);
  json(response, 500, {error: 'registry_unavailable'});
})).listen(port, '127.0.0.1', () => {
  console.log(`Read-only registry: http://127.0.0.1:${port}`);
});
