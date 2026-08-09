import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  limit,
  Timestamp,
  getDocFromServer,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';
import { FirebaseWebConfig } from '../types';
import localConfig from '../../firebase-applet-config.json';

// Local applet config import
export const localFirebaseConfig: FirebaseWebConfig = localConfig as FirebaseWebConfig;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

// App instances cache
const appCache = new Map<string, { app: FirebaseApp; db: Firestore; auth: Auth }>();

export function getFirebaseInstance(connectionId: string, config: FirebaseWebConfig) {
  if (appCache.has(connectionId)) {
    return appCache.get(connectionId)!;
  }

  // Generate unique app name based on connectionId
  const appName = `app-${connectionId}`;
  let app: FirebaseApp;
  
  const existingApps = getApps();
  const matchedApp = existingApps.find(a => a.name === appName);
  
  if (matchedApp) {
    app = matchedApp;
  } else {
    app = initializeApp(config, appName);
  }

  // Support custom firestoreDatabaseId if specified
  const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
  let auth: Auth;
  try {
    auth = getAuth(app);
  } catch (err) {
    console.warn("Could not initialize Firebase Auth:", err);
    auth = getAuth(app);
  }

  const instance = { app, db, auth };
  appCache.set(connectionId, instance);
  return instance;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  auth: Auth
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error Detailed Info:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Simple test connection method as required by the skill
export async function testConnection(db: Firestore, auth: Auth) {
  try {
    await getDocFromServer(doc(db, 'test-connection-probe', 'validate'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
    return false;
  }
}

// Parse value securely back and forth
export function stringToTypedValue(valStr: string, type: string) {
  if (type === 'number') {
    const num = Number(valStr);
    return isNaN(num) ? 0 : num;
  }
  if (type === 'boolean') {
    return valStr.toLowerCase() === 'true';
  }
  if (type === 'null') {
    return null;
  }
  if (type === 'timestamp') {
    try {
      const date = new Date(valStr);
      return Timestamp.fromDate(isNaN(date.getTime()) ? new Date() : date);
    } catch {
      return Timestamp.now();
    }
  }
  if (type === 'array') {
    try {
      const parsed = JSON.parse(valStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    // Comma-separated string parsing if JSON parse failed
    return valStr.split(',').map(s => s.trim()).filter(s => s !== '');
  }
  if (type === 'object' || type === 'json') {
    try {
      return JSON.parse(valStr);
    } catch {
      try {
        // Fallback for simple key:value inputs
        const obj: Record<string, string> = {};
        valStr.split(',').forEach(part => {
          const [k, v] = part.split(':');
          if (k && v) obj[k.trim()] = v.trim();
        });
        if (Object.keys(obj).length > 0) return obj;
      } catch {}
      return {};
    }
  }
  return valStr;
}

export function formatFirestoreValue(val: any): { text: string; type: string } {
  if (val === null) {
    return { text: 'null', type: 'null' };
  }
  if (val instanceof Timestamp) {
    return { text: val.toDate().toISOString(), type: 'timestamp' };
  }
  if (Array.isArray(val)) {
    return { text: JSON.stringify(val), type: 'array' };
  }
  if (typeof val === 'object') {
    if (val && typeof val.toDate === 'function') {
      return { text: val.toDate().toISOString(), type: 'timestamp' };
    }
    return { text: JSON.stringify(val), type: 'object' };
  }
  return { text: String(val), type: typeof val };
}

export interface RobustJsonResult<T = any> {
  data: T | null;
  error: string | null;
  autoFixed?: boolean;
  cleanedJson?: string;
  line?: number;
  column?: number;
}

export function robustParseJson<T = any>(input: string): RobustJsonResult<T> {
  if (!input || !input.trim()) {
    return { data: null, error: 'Порожній вміст JSON / Empty JSON content' };
  }

  const raw = input.trim();

  // 1. Try standard JSON.parse first
  try {
    const data = JSON.parse(raw);
    return { data, error: null };
  } catch (err1: any) {
    // 2. Try robust cleaning for common formatting issues (comments, trailing commas, smart quotes)
    let cleaned = raw
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([\}\]])/g, '$1')
      .replace(/[\u201C\u201D«»]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    try {
      const data = JSON.parse(cleaned);
      return { data, error: null, autoFixed: true, cleanedJson: cleaned };
    } catch (err2: any) {
      const errMsg = err1?.message || err2?.message || 'SyntaxError';
      let line: number | undefined;
      let column: number | undefined;

      const lineColMatch = errMsg.match(/line (\d+) column (\d+)/i);
      if (lineColMatch) {
        line = parseInt(lineColMatch[1], 10);
        column = parseInt(lineColMatch[2], 10);
      } else {
        const posMatch = errMsg.match(/at position (\d+)/i);
        if (posMatch) {
          const pos = parseInt(posMatch[1], 10);
          const lines = raw.substring(0, pos).split('\n');
          line = lines.length;
          column = lines[lines.length - 1].length + 1;
        }
      }

      return {
        data: null,
        error: errMsg,
        cleanedJson: cleaned,
        line,
        column
      };
    }
  }
}
