import {createServer, IncomingMessage, ServerResponse} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {searchRegistry} from '../../src/editorialRegistry/search';
import {RegistrySnapshot} from '../../src/editorialRegistry/types';

export interface RegistryServerOptions {
  snapshotPath: string; apiKey?: string; requireApiKey: boolean; publicBaseUrl?: string;
  allowedOrigin?: string; rateLimitPerMinute: number;
}

const allowedSources = new Set(['MYTHOS', 'MMLU', 'ARC', 'OPENBOOK_QA', 'QASC', 'GENERIC']);

function json(response: ServerResponse, status: number, body: unknown, origin?: string) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(origin ? {'access-control-allow-origin': origin} : {})});
  response.end(JSON.stringify(body));
}

function authorized(request: IncomingMessage, expected?: string): boolean {
  if (!expected) return false;
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(value.slice(7), 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

function openApi(baseUrl?: string) {
  return {
    openapi: '3.1.0', info: {title: 'Mythos Editorial Registry', version: '1.0.0', description: 'Read-only search over Mythos and approved external dataset snapshots.'},
    ...(baseUrl ? {servers: [{url: baseUrl.replace(/\/$/, '')}]} : {}),
    components: {securitySchemes: {bearerAuth: {type: 'http', scheme: 'bearer'}}}, security: [{bearerAuth: []}],
    paths: {
      '/v1/search': {get: {operationId: 'searchEditorialRegistry', summary: 'Search existing Mythos terms and approved external dataset snapshots', parameters: [
        {name: 'q', in: 'query', required: true, schema: {type: 'string', minLength: 2, maxLength: 200}},
        {name: 'sources', in: 'query', schema: {type: 'string'}, description: 'Comma-separated: MYTHOS,MMLU,ARC,OPENBOOK_QA,QASC,GENERIC'},
        {name: 'limit', in: 'query', schema: {type: 'integer', minimum: 1, maximum: 100, default: 20}},
      ], responses: {'200': {description: 'Read-only search results'}}}},
      '/v1/coverage': {get: {operationId: 'getEditorialCoverage', summary: 'Count indexed records and disciplines', responses: {'200': {description: 'Coverage summary'}}}},
    },
  };
}

export async function createRegistryHandler(options: RegistryServerOptions) {
  if (options.requireApiKey && !options.apiKey) throw new Error('REGISTRY_API_KEY is required in public mode');
  const snapshot = JSON.parse(await fs.readFile(options.snapshotPath, 'utf8')) as RegistrySnapshot;
  const buckets = new Map<string, {minute: number; count: number}>();
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'GET') return json(response, 405, {error: 'read_only_api'}, options.allowedOrigin);
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (url.pathname === '/health') return json(response, 200, {status: 'ok', generatedAt: snapshot.generatedAt});
    if (url.pathname === '/openapi.json') return json(response, 200, openApi(options.publicBaseUrl));
    if (options.requireApiKey && !authorized(request, options.apiKey)) { response.setHeader('www-authenticate', 'Bearer'); return json(response, 401, {error: 'unauthorized'}, options.allowedOrigin); }
    const client = request.socket.remoteAddress ?? 'unknown';
    const minute = Math.floor(Date.now() / 60_000);
    const bucket = buckets.get(client);
    const current = bucket?.minute === minute ? bucket : {minute, count: 0}; current.count += 1; buckets.set(client, current);
    if (current.count > options.rateLimitPerMinute) return json(response, 429, {error: 'rate_limited'}, options.allowedOrigin);
    if (url.pathname === '/v1/search') {
      const query = (url.searchParams.get('q') ?? '').trim();
      if (query.length < 2 || query.length > 200) return json(response, 400, {error: 'q_must_be_2_to_200_characters'}, options.allowedOrigin);
      const sources = url.searchParams.get('sources')?.split(',').map(value => value.trim().toUpperCase()).filter(Boolean);
      if (sources?.some(source => !allowedSources.has(source))) return json(response, 400, {error: 'unsupported_source'}, options.allowedOrigin);
      const limit = Number(url.searchParams.get('limit') ?? 20);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) return json(response, 400, {error: 'limit_must_be_1_to_100'}, options.allowedOrigin);
      return json(response, 200, {query, results: searchRegistry(snapshot, query, {sources, limit})}, options.allowedOrigin);
    }
    if (url.pathname === '/v1/coverage') {
      const disciplines: Record<string, number> = {};
      snapshot.usages.flatMap(usage => usage.disciplines).forEach(item => disciplines[item] = (disciplines[item] ?? 0) + 1);
      return json(response, 200, {generatedAt: snapshot.generatedAt, sources: snapshot.sources, disciplines}, options.allowedOrigin);
    }
    return json(response, 404, {error: 'not_found'}, options.allowedOrigin);
  };
}

export async function startRegistryServer() {
  const options: RegistryServerOptions = {snapshotPath: path.resolve(process.env.REGISTRY_PATH ?? 'content-registry/generated/registry.json'), apiKey: process.env.REGISTRY_API_KEY, requireApiKey: process.env.REQUIRE_API_KEY === 'true', publicBaseUrl: process.env.PUBLIC_BASE_URL, allowedOrigin: process.env.REGISTRY_ALLOWED_ORIGIN, rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60)};
  const host = process.env.REGISTRY_HOST ?? '127.0.0.1'; const port = Number(process.env.PORT ?? process.env.REGISTRY_PORT ?? 4317);
  const handler = await createRegistryHandler(options);
  return createServer((request, response) => handler(request, response).catch(error => { console.error(error); json(response, 500, {error: 'registry_unavailable'}, options.allowedOrigin); })).listen(port, host, () => console.log(`Read-only registry: http://${host}:${port}`));
}

const entryUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (entryUrl && import.meta.url === entryUrl) await startRegistryServer();
