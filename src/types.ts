export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  firestoreDatabaseId?: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

export interface SavedConnection {
  id: string;
  name: string;
  config: FirebaseWebConfig;
  isLocal: boolean;
  createdAt: number;
}

export type FirestoreValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'null'
  | 'array'
  | 'map';

export interface QueryFilter {
  field: string;
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'array-contains' | 'in';
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'null';
}
