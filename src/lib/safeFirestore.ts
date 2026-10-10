import * as sdk from 'firebase/firestore';
import { assertRemoteWriteAllowed } from './writePolicy';
export * from 'firebase/firestore';

function guarded<T extends (...args: any[]) => any>(operation: T): T {
  return (async (...args: any[]) => { assertRemoteWriteAllowed(); return operation(...args); }) as T;
}
export const setDoc = guarded(sdk.setDoc);
export const addDoc = guarded(sdk.addDoc);
export const updateDoc = guarded(sdk.updateDoc);
export const deleteDoc = guarded(sdk.deleteDoc);
export const runTransaction = guarded(sdk.runTransaction);
export const writeBatch: typeof sdk.writeBatch = (...args) => { assertRemoteWriteAllowed(); return sdk.writeBatch(...args); };
