import * as sdk from 'firebase/functions';
import { assertRemoteWriteAllowed } from './writePolicy';
export * from 'firebase/functions';
const readOnlyCalls = new Set(['getTournamentEventAccess', 'getTournamentEventStandings']);
export const httpsCallable: typeof sdk.httpsCallable = (functions, name, options) => {
  if (!readOnlyCalls.has(name)) assertRemoteWriteAllowed();
  return sdk.httpsCallable(functions, name, options);
};
