import * as sdk from 'firebase/storage';
import { assertRemoteWriteAllowed } from './writePolicy';
export * from 'firebase/storage';
export const uploadBytes: typeof sdk.uploadBytes = async (...args) => { assertRemoteWriteAllowed(); return sdk.uploadBytes(...args); };
