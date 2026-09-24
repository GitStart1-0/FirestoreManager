import assert from 'node:assert/strict';
import test from 'node:test';
import {searchRegistry} from './search';
import {RegistrySnapshot} from './types';

const snapshot: RegistrySnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-01-01T00:00:00.000Z',
  sources: [{source: 'MYTHOS', records: 1}],
  usages: [{
    source: 'MYTHOS', sourceId: 'q1', terms: ['Ефект Доплера'], disciplines: ['physics'],
    conceptId: 'PHY_WAV_DOPPLER', question: 'Чому змінюється висота звуку?', sourceFile: 'level-1.json',
  }],
};

test('finds Ukrainian terms and concept ids', () => {
  assert.equal(searchRegistry(snapshot, 'ефект Доплера')[0]?.sourceId, 'q1');
  assert.equal(searchRegistry(snapshot, 'PHY WAV DOPPLER')[0]?.conceptId, 'PHY_WAV_DOPPLER');
});

test('does not return unrelated records', () => {
  assert.deepEqual(searchRegistry(snapshot, 'фотосинтез'), []);
});
