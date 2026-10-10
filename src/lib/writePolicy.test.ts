import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localReadOnly } from './writePolicy';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, updateDoc, writeBatch, runTransaction } from './safeFirestore';
import { uploadBytes } from './safeStorage';
import { httpsCallable } from './safeFunctions';
test('local and development constructors cannot write even with a production Firebase connection', () => {
  for (const host of ['localhost', '127.0.0.1', '::1', '[::1]', '']) assert.equal(localReadOnly(host, false), true);
  assert.equal(localReadOnly('192.168.1.20', true), true);
  assert.equal(localReadOnly('aistudio.google.com', false), false);
});
test('every existing publishing path rejects locally before sending a request', async () => {
  const app = initializeApp({ projectId: 'local-readonly-test', apiKey: 'test', appId: 'test' }, 'local-readonly-test');
  try {
    const db = getFirestore(app);
    const target = doc(db, 'content', 'test');
    const blocked = /Локальний конструктор/;
    await assert.rejects(setDoc(target, { value: 1 }), blocked);
    await assert.rejects(updateDoc(target, { value: 1 }), blocked);
    await assert.rejects(deleteDoc(target), blocked);
    await assert.rejects(runTransaction(db, async () => assert.fail('Transaction must never start')), blocked);
    assert.throws(() => writeBatch(db), blocked);
    await assert.rejects(uploadBytes(null as any, new Uint8Array()), blocked);
    assert.throws(() => httpsCallable(null as any, 'createTournamentEvent'), blocked);
    assert.throws(() => httpsCallable(null as any, 'publishTournamentQuestion'), blocked);
  } finally { await deleteApp(app); }
});
