/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
  Timestamp,
  getFirestore,
  runTransaction
} from 'firebase/firestore';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import {
  Database,
  Plus,
  Search,
  Trash2,
  Edit3,
  Settings,
  Link,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Play,
  Filter,
  X,
  LogOut,
  LogIn,
  Copy,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Palette,
  Info,
  FolderOpen,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Check,
  Image,
  Music,
  Layers,
  Sparkles,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getFirebaseInstance,
  localFirebaseConfig,
  handleFirestoreError,
  OperationType,
  formatFirestoreValue,
  stringToTypedValue,
  robustParseJson
} from './lib/firebaseHelper';
import { SavedConnection, FirebaseWebConfig, QueryFilter } from './types';
import { adaptMainToTournamentSingleChoice } from './services/tournamentQuestionAdapter';
import { normalizeApostrophes, slugify } from './shared/text/slugify';
import { LazyPanelFallback } from './shared/ui/LazyPanelFallback';
import {
  publishTournamentQuestion,
  TournamentQuestionPayload,
} from './features/tournaments/publishTournamentQuestion';

const NoesisConstructor = lazy(() => import('./components/NoesisConstructor'));
const QuestionVisualForm = lazy(async () => {
  const module = await import('./features/questionWorkspace/QuestionVisualForm');
  return { default: module.QuestionVisualForm };
});

import {
  QUESTION_TEMPLATES,
  detectQuestionTemplate,
  getNestedQuestions,
  getQuestionTypeColors
} from './features/questionWorkspace/questionTemplates';

export default function App() {
  // Connections config
  const [connections, setConnections] = useState<SavedConnection[]>(() => {
    const localConn: SavedConnection = {
      id: 'local',
      name: 'Provisioned Firebase (Applet DB)',
      config: localFirebaseConfig,
      isLocal: true,
      createdAt: Date.now()
    };
    try {
      const stored = localStorage.getItem('firestore_mgr_connections');
      const parsed: SavedConnection[] = stored ? JSON.parse(stored) : [];
      return [localConn, ...parsed];
    } catch {
      return [localConn];
    }
  });
  const [activeConnId, setActiveConnId] = useState<string>(() => {
    try {
      // First try to load previously saved active connection
      const activeSaved = localStorage.getItem('firestore_mgr_active_conn_id');
      if (activeSaved) {
        const stored = localStorage.getItem('firestore_mgr_connections');
        const parsed: SavedConnection[] = stored ? JSON.parse(stored) : [];
        const exists = activeSaved === 'local' || parsed.some(c => c.id === activeSaved);
        if (exists) {
          return activeSaved;
        }
      }
      
      // Fallback: Default to first custom connection if any exists to prioritize user's choice
      const stored = localStorage.getItem('firestore_mgr_connections');
      const parsed: SavedConnection[] = stored ? JSON.parse(stored) : [];
      if (parsed.length > 0) {
        return parsed[0].id;
      }
    } catch {}
    return 'local';
  });
  
  // Persist active connection choice on change
  useEffect(() => {
    localStorage.setItem('firestore_mgr_active_conn_id', activeConnId);
  }, [activeConnId]);

  // Sync saved connections across devices (e.g. mobile <-> laptop) using cloud storage
  useEffect(() => {
    let isSubscribed = true;
    const syncCloudConnections = async () => {
      try {
        const localInst = getFirebaseInstance('local', localFirebaseConfig);
        if (!localInst || !localInst.db) return;
        
        const snap = await getDocs(collection(localInst.db, '_workspace_saved_connections'));
        if (!snap.empty && isSubscribed) {
          const cloudConns: SavedConnection[] = [];
          snap.forEach(d => {
            const data = d.data();
            if (data && data.config && data.config.projectId) {
              cloudConns.push({
                id: d.id,
                name: data.name || data.config.projectId,
                config: data.config,
                isLocal: false,
                createdAt: data.createdAt || Date.now()
              });
            }
          });
          
          if (cloudConns.length > 0) {
            setConnections(prev => {
              const localOnly = prev[0]; // 'local'
              const existingMap = new Map<string, SavedConnection>();
              prev.slice(1).forEach(c => existingMap.set(c.id, c));
              cloudConns.forEach(c => existingMap.set(c.id, c));
              const merged = [localOnly, ...Array.from(existingMap.values())];
              try {
                localStorage.setItem('firestore_mgr_connections', JSON.stringify(merged.filter(c => !c.isLocal)));
              } catch {}
              return merged;
            });

            // Automatically switch active connection to user's custom project if currently on default 'local'
            const currentActiveSaved = localStorage.getItem('firestore_mgr_active_conn_id');
            if (!currentActiveSaved || currentActiveSaved === 'local') {
              setActiveConnId(cloudConns[0].id);
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch cloud workspace connections:', e);
      }
    };

    syncCloudConnections();
    return () => { isSubscribed = false; };
  }, []);

  const [showNewConn, setShowNewConn] = useState(false);
  
  // Custom connection form
  const [newConnName, setNewConnName] = useState('');
  const [newConnConfig, setNewConnConfig] = useState('');
  const [connError, setConnError] = useState<string | null>(null);

  // Collections list
  const [collectionsList, setCollectionsList] = useState<string[]>(() => {
    const defaultCols = [
      'noesis',
      'agora',
      'erudite',
      'science',
      'philosophy',
      'culture',
      'tournaments',
      'users',
      'friendRequests',
      'debateDisciplines',
      'debateTopics',
      'debateSessions',
      'questions',
      'quizzes'
    ];
    try {
      const storedCols = localStorage.getItem('firestore_mgr_collections');
      if (storedCols) {
        const parsed: string[] = JSON.parse(storedCols);
        return Array.from(new Set([...defaultCols, ...parsed]));
      }
      return defaultCols;
    } catch {
      return defaultCols;
    }
  });
  const [activeCol, setActiveCol] = useState<string>(() => {
    const defaultCols = [
      'noesis',
      'agora',
      'erudite',
      'science',
      'philosophy',
      'culture',
      'tournaments',
      'users',
      'friendRequests',
      'debateDisciplines',
      'debateTopics',
      'debateSessions',
      'questions',
      'quizzes'
    ];
    try {
      const storedCat = localStorage.getItem('noesis_category');
      if (storedCat) return storedCat;

      const storedCols = localStorage.getItem('firestore_mgr_collections');
      const parsedCols: string[] = storedCols ? JSON.parse(storedCols) : defaultCols;
      const initialActive = parsedCols[0] || 'noesis';
      // If the current active is 'questions' and has insufficient permissions,
      // default connection can safely start with a fully-permitted collection 'noesis'.
      return initialActive === 'questions' ? 'noesis' : initialActive;
    } catch {
      return 'noesis';
    }
  });
  const [newColInput, setNewColInput] = useState('');

  // Sidebar collapse/expand state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('firestore_mgr_sidebar_collapsed');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    const newVal = !sidebarCollapsed;
    setSidebarCollapsed(newVal);
    try {
      localStorage.setItem('firestore_mgr_sidebar_collapsed', String(newVal));
    } catch {}
  };

  // Monitored path custom colors state
  const [pathColors, setPathColors] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('firestore_mgr_path_colors');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const updatePathColor = (pathStr: string, color: string) => {
    const updated = { ...pathColors, [pathStr]: color };
    setPathColors(updated);
    try {
      localStorage.setItem('firestore_mgr_path_colors', JSON.stringify(updated));
    } catch {}
  };

  const [activeColorPickerPath, setActiveColorPickerPath] = useState<string | null>(null);

  const getFolderColorClass = (colorName: string) => {
    switch (colorName) {
      case 'orange': return 'text-orange-500';
      case 'emerald': return 'text-emerald-500';
      case 'blue': return 'text-blue-500';
      case 'violet': return 'text-violet-500';
      case 'rose': return 'text-rose-500';
      case 'slate': return 'text-slate-500';
      default: return 'text-amber-500';
    }
  };

  // Documents state
  const [documents, setDocuments] = useState<{ id: string; data: any }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docOperationError, setDocOperationError] = useState<string | null>(null);

  // Search/Filters state
  const [queryFilters, setQueryFilters] = useState<QueryFilter[]>([]);
  const [newFilterField, setNewFilterField] = useState('');
  const [newFilterOp, setNewFilterOp] = useState<QueryFilter['operator']>('==');
  const [newFilterVal, setNewFilterVal] = useState('');
  const [newFilterType, setNewFilterType] = useState<QueryFilter['valueType']>('string');
  const [queryLimit, setQueryLimit] = useState<number>(50);

  // Selected document editor/viewer state
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; data: any } | null>(null);
  const [subcollectionQuestions, setSubcollectionQuestions] = useState<{ id: string; data: any; lang: string }[]>([]);
  const [isFetchingSubcollection, setIsFetchingSubcollection] = useState(false);
  const [editDocId, setEditDocId] = useState<string>('');
  const [editFields, setEditFields] = useState<{ key: string; value: string; type: string }[]>([]);
  const [addNewFieldKey, setAddNewFieldKey] = useState('');
  const [addNewFieldVal, setAddNewFieldVal] = useState('');
  const [addNewFieldType, setAddNewFieldType] = useState('string');
  const [editTabMode, setEditTabMode] = useState<'visual' | 'raw'>('visual');

  // New Document modal
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocId, setNewDocId] = useState('');
  const [newDocFields, setNewDocFields] = useState<{ key: string; value: string; type: string }[]>([
    { key: 'name', value: 'New Document', type: 'string' }
  ]);
  const [createTabMode, setCreateTabMode] = useState<'visual' | 'raw'>('visual');

  // Bulk Import state
  const [importJson, setImportJson] = useState('');
  const [importTarget, setImportTarget] = useState<string>(() => {
    try {
      const storedCat = localStorage.getItem('noesis_category');
      if (storedCat) return storedCat;

      const storedCols = localStorage.getItem('firestore_mgr_collections');
      const defaultCols = ['questions', 'quizzes', 'users', 'todos', 'posts', 'products', 'orders', 'logs', 'feedback'];
      const parsedCols: string[] = storedCols ? JSON.parse(storedCols) : defaultCols;
      return parsedCols[0] || 'questions';
    } catch {
      return 'questions';
    }
  });
  const [importLog, setImportLog] = useState<{ type: 'success' | 'error'; message: string }[]>([]);
  const [importing, setImporting] = useState(false);

  // Single Question Import state
  const [importTabMode, setImportTabMode] = useState<'single' | 'bulk'>('single');
  const [singleQuestionLevel, setSingleQuestionLevel] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('noesis_level');
      return stored ? Number(stored) : 1;
    } catch {
      return 1;
    }
  });
  const [singleQuestionLang, setSingleQuestionLang] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_lang') || 'ua';
    } catch {
      return 'ua';
    }
  });
  const [singleQuestionNumber, setSingleQuestionNumber] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_qnum') || '1';
    } catch {
      return '1';
    }
  });

  const updateSingleQuestionNumber = (val: string | ((prev: string) => string)) => {
    setSingleQuestionNumber(prev => {
      const nextVal = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('noesis_qnum', nextVal);
      } catch {}
      return nextVal;
    });
  };

  const extractAndSyncSingleQuestionMeta = (parsedObj: any) => {
    if (!parsedObj || typeof parsedObj !== 'object') return;
    
    if (parsedObj.id && typeof parsedObj.id === 'string' && parsedObj.id.includes('--')) {
      const idParts = parsedObj.id.split('--');
      if (idParts.length >= 2) {
        const qNumParsed = String(parseInt(idParts[1], 10) || 1);
        updateSingleQuestionNumber(qNumParsed);

        if (idParts[0]) {
          setSingleQuestionLang(idParts[0]);
          try { localStorage.setItem('noesis_lang', idParts[0]); } catch {}
        }

        if (idParts.length >= 5) {
          setSingleQuestionBlock(idParts[2]);
          try { localStorage.setItem('noesis_block', idParts[2]); } catch {}
          const extractedSlug = idParts.slice(3, -1).join('--');
          setSingleQuestionSlug(extractedSlug);
          try {
            localStorage.setItem('noesis_single_q_slug', extractedSlug);
            localStorage.setItem('noesis_question_id_name', extractedSlug);
          } catch {}
          setSingleQuestionSuffix(idParts[idParts.length - 1]);
        } else if (idParts.length === 4) {
          setSingleQuestionSlug(idParts[2]);
          try {
            localStorage.setItem('noesis_single_q_slug', idParts[2]);
            localStorage.setItem('noesis_question_id_name', idParts[2]);
          } catch {}
          setSingleQuestionSuffix(idParts[3]);
        } else if (idParts.length === 3) {
          setSingleQuestionSlug(idParts[2]);
          try {
            localStorage.setItem('noesis_single_q_slug', idParts[2]);
            localStorage.setItem('noesis_question_id_name', idParts[2]);
          } catch {}
        }
      }
    } else {
      const extractedNum = parsedObj.questionNumber ?? parsedObj.qNum ?? parsedObj.number;
      if (extractedNum !== undefined && extractedNum !== null && String(extractedNum).trim() !== '') {
        updateSingleQuestionNumber(String(extractedNum));
      }
      if (parsedObj.block) {
        setSingleQuestionBlock(String(parsedObj.block));
        try { localStorage.setItem('noesis_block', String(parsedObj.block)); } catch {}
      }
      if (parsedObj.lang) {
        setSingleQuestionLang(String(parsedObj.lang));
        try { localStorage.setItem('noesis_lang', String(parsedObj.lang)); } catch {}
      }
    }
  };
  const [singleQuestionBlock, setSingleQuestionBlock] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_block') || 'A';
    } catch {
      return 'A';
    }
  });
  const [singleQuestionSlug, setSingleQuestionSlug] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_single_q_slug') || localStorage.getItem('noesis_question_id_name') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('noesis_single_q_slug', singleQuestionSlug);
      localStorage.setItem('noesis_question_id_name', singleQuestionSlug);
    } catch {}
  }, [singleQuestionSlug]);
  const [singleQuestionSuffix, setSingleQuestionSuffix] = useState<string>(() => Math.random().toString(36).substring(2, 6));
  const [singleQuestionLiteratureHidden, setSingleQuestionLiteratureHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('noesis_single_q_lit_hidden') === 'true';
    } catch {
      return false;
    }
  });
  const [saveSingleToTournament, setSaveSingleToTournament] = useState<boolean>(() => {
    try {
      return localStorage.getItem('noesis_save_single_to_tournament') === 'true';
    } catch {
      return false;
    }
  });
  const [singleTournamentJson, setSingleTournamentJson] = useState<string>('');
  const [tournamentCategoryId, setTournamentCategoryId] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_tournament_category_id') || 'science';
    } catch {
      return 'science';
    }
  });
  const [tournamentDifficulty, setTournamentDifficulty] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('noesis_tournament_difficulty')) || 2;
    } catch {
      return 2;
    }
  });
  const [tournamentSeasonId, setTournamentSeasonId] = useState<string>(() => {
    try {
      return localStorage.getItem('noesis_tournament_season_id') || '';
    } catch {
      return '';
    }
  });
  const [singleQuestionJson, setSingleQuestionJson] = useState<string>('');
  const [singleQuestionImporting, setSingleQuestionImporting] = useState(false);
  const [singleImportResult, setSingleImportResult] = useState<{
    mainQuestionId?: string;
    tournamentQuestionId?: string;
    tournamentError?: string;
  } | null>(null);

  // Active Screen Tab
  const [activeTab, setActiveTab] = useState<'explorer' | 'constructor' | 'import' | 'credentials'>('constructor');

  // Load Request from Explorer to Constructor
  const [loadRequest, setLoadRequest] = useState<{
    category: string;
    level: number;
    lang: string;
    questionId: string;
    questionData: any;
  } | null>(null);

  // Auth User Tracker
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [lastAuthError, setLastAuthError] = useState<string | null>(null);
  const [bypassAuth, setBypassAuth] = useState(() => {
    try {
      return localStorage.getItem('firestore_mgr_bypass_auth') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleBypassAuth = () => {
    const nextVal = !bypassAuth;
    setBypassAuth(nextVal);
    try {
      localStorage.setItem('firestore_mgr_bypass_auth', String(nextVal));
    } catch {}
    triggerToast(nextVal ? 'Guest Mode Active (Bypass Login)' : 'Auth Required Mode Active', 'success');
  };

  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uidCopied, setUidCopied] = useState(false);

  function triggerToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Save changes to localStorage on collection list updates
  function saveCollectionsList(newPaths: string[]) {
    setCollectionsList(newPaths);
    localStorage.setItem('firestore_mgr_collections', JSON.stringify(newPaths));
  }

  // Retrieve current active connection
  const activeConn = connections.find(c => c.id === activeConnId) || connections[0];

  // Initialize/get live client instances (app, db, auth)
  let dbInstance: any;
  let authInstance: any;

  if (activeConn) {
    try {
      const instance = getFirebaseInstance(activeConn.id, activeConn.config);
      dbInstance = instance.db;
      authInstance = instance.auth;
    } catch (e) {
      console.error("Could not obtain connection instances: ", e);
    }
  }

  // Track Auth Changes
  useEffect(() => {
    if (!authInstance) return;
    setAuthChecking(true);
    
    // Safely clear loading indicator if network or Firebase response is sluggish
    const timeoutId = setTimeout(() => {
      setAuthChecking(false);
    }, 3000);

    let unsubscribe = () => {};
    try {
      unsubscribe = authInstance.onAuthStateChanged(
        (user: User | null) => {
          clearTimeout(timeoutId);
          setCurrentUser(user);
          setAuthChecking(false);
          setLastAuthError(null);
        },
        (error: any) => {
          clearTimeout(timeoutId);
          console.warn('Firebase Auth State Error:', error);
          setAuthChecking(false);
          const errMsg = error?.message || String(error);
          setLastAuthError(errMsg);
          if (errMsg.includes('api-key-not-valid') || error?.code === 'auth/api-key-not-valid') {
            setBypassAuth(true);
            try { localStorage.setItem('firestore_mgr_bypass_auth', 'true'); } catch {}
          }
        }
      );
    } catch (e: any) {
      clearTimeout(timeoutId);
      setAuthChecking(false);
      console.warn('Failed to attach auth state listener:', e);
    }

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [activeConnId, authInstance]);

  // Load Documents from active Collection Path
  const fetchDocuments = async () => {
    if (!currentUser && !bypassAuth) {
      setDocuments([]);
      setDocOperationError(null);
      return;
    }
    if (!dbInstance || !activeCol) return;
    setLoadingDocs(true);
    setDocOperationError(null);
    try {
      let q = collection(dbInstance, activeCol);
      
      // If we have custom query constraints
      const constraints: any[] = [];
      queryFilters.forEach(f => {
        const typedVal = stringToTypedValue(f.value, f.valueType);
        constraints.push(where(f.field, f.operator, typedVal));
      });
      
      constraints.push(limit(queryLimit));
      
      const queryRef = query(q, ...constraints);
      const querySnapshot = await getDocs(queryRef);
      
      const docsData = querySnapshot.docs.map(d => ({
        id: d.id,
        data: d.data()
      }));
      setDocuments(docsData);
    } catch (error: any) {
      console.error(error);
      const errMessage = error.message || String(error);
      setDocOperationError(errMessage);
      triggerToast('Failed to fetch documents', 'error');
      try {
        handleFirestoreError(error, OperationType.LIST, activeCol, authInstance);
      } catch (formattedErr: any) {
        throw formattedErr;
      }
    } finally {
      setLoadingDocs(false);
    }
  };

  // Re-run document queries when active selection triggers change
  useEffect(() => {
    fetchDocuments();
    setSelectedDoc(null);
  }, [activeConnId, activeCol, queryFilters, queryLimit, currentUser, bypassAuth]);

  // Try Sign In with Google
  const handleSignIn = async () => {
    if (!authInstance) return;
    setLastAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(authInstance, provider);
      triggerToast('Signed in successfully.');
    } catch (error: any) {
      console.error(error);
      const errMsg = error.message || String(error);
      setLastAuthError(errMsg);
      if (errMsg.includes('api-key-not-valid') || error?.code === 'auth/api-key-not-valid') {
        triggerToast('Google Auth API Key is not enabled for this project. Switched to Guest Mode.', 'error');
        setBypassAuth(true);
        try { localStorage.setItem('firestore_mgr_bypass_auth', 'true'); } catch {}
      } else {
        triggerToast(errMsg, 'error');
      }
    }
  };

  // Sign out
  const handleSignOut = async () => {
    if (!authInstance) return;
    try {
      await signOut(authInstance);
      triggerToast('Signed out successfully.');
    } catch (error: any) {
      console.error(error);
      triggerToast('Sign out failed', 'error');
    }
  };

  // Add custom connection
  const handleAddConnection = () => {
    setConnError(null);
    if (!newConnName.trim() || !newConnConfig.trim()) {
      setConnError('Name and Configuration properties are both required.');
      return;
    }

    let parsedConfig: any = null;
    try {
      // First try to parse as pure standard JSON
      parsedConfig = JSON.parse(newConnConfig.trim());
    } catch {
      // If pure JSON fails, execute our ultra-robust Regex key-value extraction fallback
      const fields = [
        'apiKey',
        'authDomain',
        'projectId',
        'storageBucket',
        'messagingSenderId',
        'appId',
        'measurementId',
        'databaseURL',
        'firestoreDatabaseId'
      ];
      const extracted: Record<string, string> = {};
      
      for (const field of fields) {
        // Match standard JS object key and string/quoted/unquoted value representation
        const regex = new RegExp(`\\b${field}\\b\\s*:\\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_.-]*))`);
        const match = newConnConfig.match(regex);
        if (match) {
          const val = match[1] !== undefined ? match[1] : (match[2] !== undefined ? match[2] : match[3]);
          if (val !== undefined && val !== null) {
            extracted[field] = val;
          }
        }
      }
      
      if (extracted.apiKey !== undefined && extracted.projectId && extracted.appId) {
        parsedConfig = extracted;
      } else {
        setConnError('Could not auto-parse the Firebase web config keys. Please make sure to copy and paste the entire config block containing at least apiKey, projectId, and appId.');
        return;
      }
    }

    if (!parsedConfig || !parsedConfig.apiKey || !parsedConfig.projectId || !parsedConfig.appId) {
      setConnError('The configuration requires at least: apiKey, projectId, appId fields. Please check your credentials input.');
      return;
    }

    try {
      const newC: SavedConnection = {
        id: `custom_${Date.now()}`,
        name: newConnName.trim(),
        config: {
          apiKey: parsedConfig.apiKey,
          authDomain: parsedConfig.authDomain || `${parsedConfig.projectId}.firebaseapp.com`,
          projectId: parsedConfig.projectId,
          firestoreDatabaseId: parsedConfig.firestoreDatabaseId || '(default)',
          appId: parsedConfig.appId,
          storageBucket: parsedConfig.storageBucket || `${parsedConfig.projectId}.firebasestorage.app`,
          messagingSenderId: parsedConfig.messagingSenderId || '',
          measurementId: parsedConfig.measurementId || ''
        },
        isLocal: false,
        createdAt: Date.now()
      };

      const updated = [...connections.filter(c => !c.isLocal), newC];
      localStorage.setItem('firestore_mgr_connections', JSON.stringify(updated));
      setConnections([connections[0], ...updated]);
      
      // Save to cloud storage so mobile and other devices receive it automatically
      try {
        const localInst = getFirebaseInstance('local', localFirebaseConfig);
        if (localInst && localInst.db) {
          setDoc(doc(localInst.db, '_workspace_saved_connections', newC.id), {
            name: newC.name,
            config: newC.config,
            createdAt: newC.createdAt
          }).catch(() => {});
        }
      } catch {}

      // select new connection immediately
      setActiveConnId(newC.id);
      
      // Reset form
      setNewConnName('');
      setNewConnConfig('');
      setShowNewConn(false);
      triggerToast('Custom project imported and synced to all devices!');
    } catch (e: any) {
      setConnError(`Error creating connection profile: ${e.message}`);
    }
  };

  // Remove custom connection
  const handleRemoveConnection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'local') return;
    
    const nextList = connections.filter(c => c.id !== id);
    const saveOnlyCustom = nextList.filter(c => !c.isLocal);
    localStorage.setItem('firestore_mgr_connections', JSON.stringify(saveOnlyCustom));
    setConnections(nextList);
    
    try {
      const localInst = getFirebaseInstance('local', localFirebaseConfig);
      if (localInst && localInst.db) {
        deleteDoc(doc(localInst.db, '_workspace_saved_connections', id)).catch(() => {});
      }
    } catch {}

    if (activeConnId === id) {
      setActiveConnId('local');
    }
    triggerToast('Connection profile removed.');
  };

  // Add custom path
  const handleAddCollectionPath = (specificPath?: string) => {
    const rawInput = specificPath !== undefined ? specificPath : newColInput;
    const fresh = rawInput.trim().replace(/^\/+|\/+$/g, ''); // strip leading/trailing slashes
    if (!fresh) return;
    if (collectionsList.includes(fresh)) {
      triggerToast('Collection already monitored', 'error');
      if (specificPath === undefined) setNewColInput('');
      return;
    }

    const updated = [...collectionsList, fresh];
    saveCollectionsList(updated);
    setActiveCol(fresh);
    setImportTarget(fresh);
    if (specificPath === undefined) setNewColInput('');
    triggerToast(`Monitored path added: ${fresh}`);
  };

  // Delete path
  const handleRemoveCollectionPath = (pathToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = collectionsList.filter(p => p !== pathToRemove);
    saveCollectionsList(updated);
    
    if (activeCol === pathToRemove && updated.length > 0) {
      setActiveCol(updated[0]);
    }
    triggerToast('Collection path hidden from monitor.');
  };

  const fetchSubcollectionQuestions = async (levelId: string) => {
    if (!dbInstance || !activeCol) return;
    setIsFetchingSubcollection(true);
    setSubcollectionQuestions([]);
    
    try {
      const qList: { id: string; data: any; lang: string }[] = [];
      const parentDocRef = doc(dbInstance, activeCol, levelId);
      
      const subcolsToQuery = [
        { name: 'questions', lang: 'ua' },
        { name: 'ua_questions', lang: 'ua' },
        { name: 'en_questions', lang: 'en' },
        { name: 'de_questions', lang: 'de' }
      ];

      await Promise.all(subcolsToQuery.map(async (sub) => {
        try {
          const colRef = collection(parentDocRef, sub.name);
          const snapshot = await getDocs(colRef);
          snapshot.forEach((d) => {
            const data = d.data();
            let quesLang = data.lang || sub.lang || 'ua';
            // Also inspect id prefix to be safe (e.g. en--01--A => en)
            const idParts = d.id.split('--');
            if (idParts[0] && ['ua', 'en', 'de', 'es', 'fr'].includes(idParts[0])) {
              quesLang = idParts[0];
            }
            qList.push({
              id: d.id,
              data: data,
              lang: quesLang
            });
          });
        } catch (e) {
          // Perfectly fine for some subcollections to be missing (e.g., only questions/ exists)
          console.log(`Subcollection ${sub.name} not loaded:`, e);
        }
      }));

      // Sort by index segment of ID e.g. ua--01--A => 1
      qList.sort((a, b) => {
        const aParts = a.id.split('--');
        const bParts = b.id.split('--');
        const aNum = parseInt(aParts[1], 10) || 1;
        const bNum = parseInt(bParts[1], 10) || 1;
        return aNum - bNum;
      });

      setSubcollectionQuestions(qList);
    } catch (err: any) {
      console.error("Error fetching subcollection questions:", err);
    } finally {
      setIsFetchingSubcollection(false);
    }
  };

  // Setup Document details for currently clicked document
  const openDocDetails = (docSelected: { id: string; data: any }) => {
    setSelectedDoc(docSelected);
    setEditDocId(docSelected.id);
    // Parse properties into flat key value array
    const fieldsArr = Object.entries(docSelected.data).map(([key, value]) => {
      const formatted = formatFirestoreValue(value);
      return {
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        type: formatted.type
      };
    });
    setEditFields(fieldsArr);
    
    // Also fetch subcollection questions
    fetchSubcollectionQuestions(docSelected.id);
  };

  // Add field to active document edit state
  const handleAddFieldToEdit = () => {
    if (!addNewFieldKey.trim()) return;
    if (editFields.some(f => f.key === addNewFieldKey.trim())) {
      triggerToast('Field already exists', 'error');
      return;
    }
    setEditFields([
      ...editFields,
      {
        key: addNewFieldKey.trim(),
        value: addNewFieldVal,
        type: addNewFieldType
      }
    ]);
    setAddNewFieldKey('');
    setAddNewFieldVal('');
  };

  // Delete field from active document edit list
  const handleRemoveFieldFromEdit = (key: string) => {
    setEditFields(editFields.filter(f => f.key !== key));
  };

  // Save changes to Firestore
  const handleSaveDocument = async () => {
    if (!dbInstance || !activeCol || !selectedDoc) return;
    
    // pack fields array back into schema object
    const finalData: any = {};
    editFields.forEach(f => {
      finalData[f.key] = stringToTypedValue(f.value, f.type);
    });

    const originalId = selectedDoc.id;
    const targetId = editDocId.trim();

    if (!targetId) {
      triggerToast('ID документа не може бути порожнім!', 'error');
      return;
    }

    try {
      const idChanged = targetId !== originalId;

      if (idChanged) {
        // Write new document with updated ID
        const docRefNew = doc(dbInstance, activeCol, targetId);
        await setDoc(docRefNew, finalData);

        // Delete the original document with the old ID
        const docRefOld = doc(dbInstance, activeCol, originalId);
        await deleteDoc(docRefOld);

        // Update local state by swapping old ID for the new one
        const updatedDocs = documents
          .filter(d => d.id !== originalId)
          .concat([{ id: targetId, data: finalData }]);
        
        setDocuments(updatedDocs);
        setSelectedDoc({ id: targetId, data: finalData });
        setEditDocId(targetId);

        triggerToast(`Успішно перейменовано з "${originalId}" на "${targetId}" та збережено!`, 'success');
      } else {
        // Normal save with same ID
        const docRef = doc(dbInstance, activeCol, originalId);
        await setDoc(docRef, finalData);
        
        // Update local state without query re-trigger
        const updatedDocs = documents.map(d => 
          d.id === originalId ? { ...d, data: finalData } : d
        );
        setDocuments(updatedDocs);
        setSelectedDoc({ id: originalId, data: finalData });
        
        triggerToast('Поля документа успішно збережено!');
      }
    } catch (error: any) {
      console.error(error);
      try {
        const failedId = targetId !== originalId ? targetId : originalId;
        handleFirestoreError(error, OperationType.WRITE, `${activeCol}/${failedId}`, authInstance);
      } catch (formattedErr: any) {
        setDocOperationError(formattedErr.message);
        throw formattedErr;
      }
    }
  };

  // Add fully custom fields to a new document draft
  const handleAddNewFieldName = () => {
    setNewDocFields([...newDocFields, { key: 'newField', value: '', type: 'string' }]);
  };

  // Remove field draft
  const handleRemoveNewDocField = (idx: number) => {
    setNewDocFields(newDocFields.filter((_, i) => i !== idx));
  };

  // Submit and create new Firestore document
  const handleCreateDocument = async () => {
    if (!dbInstance || !activeCol) return;
    
    const finalData: any = {};
    newDocFields.forEach(f => {
      if (f.key.trim()) {
        finalData[f.key.trim()] = stringToTypedValue(f.value, f.type);
      }
    });

    // Generate random id if left blank
    const docIdentifier = newDocId.trim() || doc(collection(dbInstance, activeCol)).id;

    try {
      const docRef = doc(dbInstance, activeCol, docIdentifier);
      await setDoc(docRef, finalData);
      
      triggerToast(`Created document ${docIdentifier}`);
      setIsAddingDoc(false);
      setNewDocId('');
      setNewDocFields([{ key: 'name', value: 'New Document', type: 'string' }]);
      fetchDocuments();
    } catch (error: any) {
      console.error(error);
      try {
        handleFirestoreError(error, OperationType.CREATE, `${activeCol}/${docIdentifier}`, authInstance);
      } catch (e: any) {
        triggerToast('Failed to create document: Permission Denied', 'error');
        throw e;
      }
    }
  };

  // Delete live document
  const handleDeleteDocument = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Are you absolutely sure you want to delete ${id}?`)) return;

    try {
      const docRef = doc(dbInstance, activeCol, id);
      await deleteDoc(docRef);
      
      setDocuments(documents.filter(d => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
      }
      triggerToast('Document deleted.');
    } catch (error: any) {
      console.error(error);
      try {
        handleFirestoreError(error, OperationType.DELETE, `${activeCol}/${id}`, authInstance);
      } catch (e: any) {
        triggerToast('Action denied: Firestore custom rules validation failed', 'error');
        throw e;
      }
    }
  };

  // Custom filters adding/removing
  const handleAddQueryFilter = () => {
    if (!newFilterField.trim()) return;
    const newF: QueryFilter = {
      field: newFilterField.trim(),
      operator: newFilterOp,
      value: newFilterVal,
      valueType: newFilterType
    };
    setQueryFilters([...queryFilters, newF]);
    setNewFilterField('');
    setNewFilterVal('');
  };

  const handleClearFilters = () => {
    setQueryFilters([]);
  };

  // Bulk Import logic
  const handleBulkImport = async (explicitTarget?: string) => {
    if (!dbInstance) {
      triggerToast('Missing database connection', 'error');
      return;
    }
    if (!importJson.trim()) {
      triggerToast('Please paste any JSON contents', 'error');
      return;
    }

    const targetCollection = explicitTarget || importTarget;
    setImporting(true);
    setImportLog([]);
    const logs: typeof importLog = [];

    const publishTournamentImport = async (data: Record<string, unknown>, sourceId: string) => {
      if (!authInstance) throw new Error('Firebase Auth не ініціалізовано.');
      const payload = {
        ...data,
        sourcePath: String(data.sourcePath || `constructor-import/${sourceId}`),
        sourceVersion: Number(data.sourceVersion) || 1,
      };
      const missingField = ['language', 'categoryId', 'type', 'question', 'difficulty', 'status']
        .find((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
      if (missingField) throw new Error(`Турнірний документ не містить обов'язкового поля: ${missingField}`);
      await publishTournamentQuestion(authInstance, payload as unknown as TournamentQuestionPayload);
    };
    
    try {
      const parseRes = robustParseJson(importJson.trim());
      if (!parseRes.data) {
        triggerToast(`Невалідний JSON синтаксис${parseRes.line ? ` (рядок ${parseRes.line}, колонка ${parseRes.column})` : ''}: ${parseRes.error}`, 'error');
        setImporting(false);
        return;
      }
      let parsed = parseRes.data;
      
      // Auto-detect Multi-collection JSON representation: e.g. { "noesis": [ ... ], "agora": [ ... ] }
      const isMultiCollection = typeof parsed === 'object' && 
                                !Array.isArray(parsed) && 
                                parsed !== null &&
                                Object.values(parsed).every(val => Array.isArray(val));

      if (isMultiCollection) {
        logs.push({ 
          type: 'success', 
          message: `🔄 Detected MULTI-COLLECTION JSON backup! Processing collections: ${Object.keys(parsed).join(', ')}.` 
        });
        setImportLog([...logs]);

        let grandTotal = 0;
        let grandSuccess = 0;
        const newDetectedCols: string[] = [];

        for (const [colName, colItems] of Object.entries(parsed)) {
          const itemsArray = colItems as any[];
          grandTotal += itemsArray.length;
          
          if (!collectionsList.includes(colName)) {
            newDetectedCols.push(colName);
          }

          logs.push({ type: 'success', message: `📁 Starting collection [${colName}]: preparing to write ${itemsArray.length} documents...` });
          setImportLog([...logs]);

          let colSuccess = 0;
          for (let i = 0; i < itemsArray.length; i++) {
            const item = itemsArray[i];
            if (!item || typeof item !== 'object') continue;

            let writeId = item.id || item.docId || item.uid || item._id;
            
            // Generate standard ID if missing
            if (!writeId) {
              writeId = doc(collection(dbInstance, colName)).id;
            }

            const dataDraft = { ...item };
            // Clean id fields inside the document structure to keep it clean
            delete dataDraft.id;
            delete dataDraft.docId;
            delete dataDraft.uid;
            delete dataDraft._id;

            try {
              if (colName === 'tournamentQuestionPools') {
                await publishTournamentImport(dataDraft, String(writeId));
              } else {
                const docRef = doc(dbInstance, colName, String(writeId));
                await setDoc(docRef, dataDraft);
              }
              colSuccess++;
              grandSuccess++;
            } catch (err: any) {
              logs.push({ type: 'error', message: `❌ [${colName}] Failed at index ${i} [${writeId}]: ${err.message}` });
            }
          }

          logs.push({ type: 'success', message: `✅ Finished [${colName}]: successfully imported ${colSuccess}/${itemsArray.length} items.` });
          setImportLog([...logs]);
        }

        // Add any newly detected collections to the Monitored Paths list
        if (newDetectedCols.length > 0) {
          const updatedPaths = Array.from(new Set([...collectionsList, ...newDetectedCols]));
          saveCollectionsList(updatedPaths);
          logs.push({ type: 'success', message: `➕ Automatically added new collections to your Monitored sidebar paths: ${newDetectedCols.join(', ')}` });
        }

        logs.push({ type: 'success', message: `🎉 Multi-collection import completed! Installed ${grandSuccess}/${grandTotal} rows across the database.` });
        setImportLog([...logs]);
        triggerToast(`Multi-import completed: ${grandSuccess} rows successfully saved!`);
        fetchDocuments();
        return;
      }

      // Single Collection Array flow (default flow)
      if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
        parsed = [parsed];
      }
      
      if (!Array.isArray(parsed)) {
        logs.push({ type: 'error', message: 'Calculated JSON is not a valid list of items or multi-collection map' });
        setImportLog(logs);
        setImporting(false);
        return;
      }

      logs.push({ type: 'success', message: `Parsed ${parsed.length} items. Writing to single collection path: "${targetCollection}"` });
      setImportLog([...logs]);

      let successfulCount = 0;
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item || typeof item !== 'object') continue;

        let writeId = item.id || item.docId || item.uid || item._id;
        
        if (!writeId) {
          writeId = doc(collection(dbInstance, importTarget)).id;
        }

        const dataDraft = { ...item };
        delete dataDraft.id;
        delete dataDraft.docId;
        delete dataDraft.uid;
        delete dataDraft._id;

        try {
          if (targetCollection === 'tournamentQuestionPools') {
            await publishTournamentImport(dataDraft, String(writeId));
          } else {
            const docRef = doc(dbInstance, targetCollection, String(writeId));
            await setDoc(docRef, dataDraft);
          }
          successfulCount++;
        } catch (itemErr: any) {
          logs.push({ type: 'error', message: `❌ Failed on index ${i} [${writeId}]: ${itemErr.message}` });
        }
      }

      logs.push({ type: 'success', message: `Import Job finished. Successfully imported ${successfulCount}/${parsed.length} rows.` });
      setImportLog([...logs]);
      triggerToast(`Imported ${successfulCount} records!`);
      
      if (activeCol === targetCollection) {
        fetchDocuments();
      }
    } catch (parseError: any) {
      logs.push({ type: 'error', message: `JSON parsing failed: ${parseError.message}` });
      setImportLog(logs);
    } finally {
      setImporting(false);
    }
  };

  // Helper to export collection
  const handleExportCollection = () => {
    if (documents.length === 0) {
      triggerToast('No document resources cached or fetched to export', 'error');
      return;
    }

    // Convert to readable JSON schema representation
    const exportData = documents.map(docItem => ({
      id: docItem.id,
      ...docItem.data
    }));

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `firestore_export_${activeCol}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerToast('Download triggered!');
  };

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeForFirestore(item));
    }
    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  };

  const buildTournamentPayloadFromMain = (mainObj: any) => {
    if (Array.isArray(mainObj)) {
      mainObj = mainObj[0] || {};
    }
    const qText = mainObj.question || mainObj.questionText || mainObj.text || '';
    
    const upperType = String(mainObj.type || '').toUpperCase().trim();
    let resolvedType = 'SINGLE_CHOICE';

    if (
      upperType === 'MULTIPLE_CHOICE' ||
      upperType === 'MULTIPLECHOICE' ||
      upperType === 'MULTI_CHOICE' ||
      upperType === 'MULTICHOICE' ||
      upperType === 'MULTI' ||
      upperType === 'MULTIPLE' ||
      upperType === 'CHECKBOX'
    ) {
      resolvedType = 'MULTIPLE_CHOICE';
    } else if (
      upperType === 'TRUE_FALSE' ||
      upperType === 'TRUEFALSE' ||
      typeof mainObj.correctAnswer === 'boolean'
    ) {
      resolvedType = 'TRUE_FALSE';
    } else if (
      upperType === 'TEXT_INPUT' ||
      upperType === 'TEXTINPUT' ||
      upperType === 'TEXT'
    ) {
      resolvedType = 'TEXT_INPUT';
    } else if (
      upperType === 'SINGLE_CHOICE' ||
      upperType === 'SINGLECHOICE' ||
      upperType === 'SINGLE'
    ) {
      resolvedType = 'SINGLE_CHOICE';
    } else if (
      (Array.isArray(mainObj.correctAnswerIndices) && mainObj.correctAnswerIndices.length > 1) ||
      (Array.isArray(mainObj.correctIndices) && mainObj.correctIndices.length > 1)
    ) {
      resolvedType = 'MULTIPLE_CHOICE';
    } else if (Array.isArray(mainObj.options)) {
      const correctCount = mainObj.options.filter((o: any) => typeof o === 'object' && o !== null && o.isCorrect).length;
      if (correctCount > 1) {
        resolvedType = 'MULTIPLE_CHOICE';
      }
    } else if (Array.isArray(mainObj.correctAnswers) && mainObj.correctAnswers.length > 0 && upperType !== 'TEXT_INPUT') {
      if (mainObj.correctAnswers.length > 1) {
        resolvedType = 'MULTIPLE_CHOICE';
      }
    }

    const rawLang = mainObj.lang || mainObj.language || singleQuestionLang || 'ua';
    const langVal = rawLang === 'uk' ? 'ua' : rawLang;

    const tPayload: any = {
      language: langVal,
      categoryId: mainObj.categoryId || tournamentCategoryId || 'science',
      type: resolvedType,
      question: qText.substring(0, 400),
      difficulty: typeof mainObj.difficulty === 'number' ? mainObj.difficulty : (tournamentDifficulty || 2),
      status: mainObj.status || 'active',
      seasonId: mainObj.seasonId || (tournamentSeasonId || '').trim() || null,
      topicLabel: mainObj.topicLabel || ((Array.isArray(mainObj.topics) && mainObj.topics.length) ? String(mainObj.topics[0]) : null),
      explanation: mainObj.explanation || null,
      timeLimitSeconds: mainObj.timeLimitSeconds || 15
    };

    if (resolvedType === 'TRUE_FALSE') {
      let boolVal = true;
      if (typeof mainObj.correctAnswer === 'boolean') {
        boolVal = mainObj.correctAnswer;
      } else if (typeof mainObj.correctIndex === 'number') {
        boolVal = mainObj.correctIndex === 0;
      } else if (Array.isArray(mainObj.options)) {
        const foundIdx = mainObj.options.findIndex((o: any) => typeof o === 'object' && o !== null && o.isCorrect);
        if (foundIdx !== -1) boolVal = (foundIdx === 0);
      }
      tPayload.correctAnswer = boolVal;
    } else if (resolvedType === 'TEXT_INPUT') {
      let answersList: string[] = [];
      if (Array.isArray(mainObj.correctAnswers)) {
        answersList = mainObj.correctAnswers.map((s: any) => String(s).trim().toLowerCase()).filter(Boolean);
      } else if (mainObj.correctAnswer) {
        answersList = [String(mainObj.correctAnswer).trim().toLowerCase()];
      } else if (typeof mainObj.correctIndex === 'number' && Array.isArray(mainObj.options)) {
        const opt = mainObj.options[mainObj.correctIndex];
        const txt = typeof opt === 'string' ? opt : (opt?.value || opt?.text || '');
        if (txt) answersList = [txt.trim().toLowerCase()];
      }
      if (answersList.length === 0) answersList = ['відповідь'];
      tPayload.correctAnswers = answersList;
    } else if (resolvedType === 'MULTIPLE_CHOICE') {
      let answersArr: string[] = [];
      let correctIdxs: number[] = [];

      const rawOpts = mainObj.options || mainObj.answers || mainObj.choices;
      if (Array.isArray(rawOpts)) {
        answersArr = rawOpts.map((o: any) => typeof o === 'string' ? o : (o.text || o.value || o.answer || String(o)));
        rawOpts.forEach((o: any, idx: number) => {
          if (typeof o === 'object' && o !== null && o.isCorrect) {
            correctIdxs.push(idx);
          }
        });
      }

      if (answersArr.length === 0) {
        answersArr = ['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D'];
      }

      if (correctIdxs.length === 0) {
        if (Array.isArray(mainObj.correctAnswerIndices)) {
          correctIdxs = mainObj.correctAnswerIndices;
        } else if (Array.isArray(mainObj.correctIndices)) {
          correctIdxs = mainObj.correctIndices;
        } else if (Array.isArray(mainObj.correctAnswers)) {
          mainObj.correctAnswers.forEach((ca: any) => {
            if (typeof ca === 'number') {
              correctIdxs.push(ca);
            } else if (typeof ca === 'string') {
              const strVal = ca.trim().toLowerCase();
              const foundIdx = answersArr.findIndex(a => a.trim().toLowerCase() === strVal);
              if (foundIdx !== -1) correctIdxs.push(foundIdx);
            }
          });
        } else if (typeof mainObj.correctIndex === 'number') {
          correctIdxs = [mainObj.correctIndex];
        }
      }

      correctIdxs = Array.from(new Set(
        correctIdxs
          .map((i: any) => Number(i))
          .filter((i: number) => !isNaN(i) && i >= 0 && i < answersArr.length)
      )).sort((a, b) => a - b);

      if (correctIdxs.length === 0) correctIdxs = [0, 1];

      if (answersArr.length > 6) {
        const correctSet = new Set(correctIdxs);
        const selectedIdxs: number[] = [];
        for (let i = 0; i < answersArr.length && selectedIdxs.length < 6; i++) {
          if (correctSet.has(i)) selectedIdxs.push(i);
        }
        for (let i = 0; i < answersArr.length && selectedIdxs.length < 6; i++) {
          if (!selectedIdxs.includes(i)) selectedIdxs.push(i);
        }
        selectedIdxs.sort((a, b) => a - b);
        answersArr = selectedIdxs.map(i => answersArr[i]);
        correctIdxs = correctIdxs.map(i => selectedIdxs.indexOf(i)).filter(i => i !== -1);
        if (correctIdxs.length === 0) correctIdxs = [0];
      }

      tPayload.answers = answersArr;
      tPayload.correctAnswerIndices = correctIdxs;
    } else {
      // SINGLE_CHOICE
      let rawOpts: any[] = [];
      if (Array.isArray(mainObj.options)) {
        rawOpts = mainObj.options;
      } else if (Array.isArray(mainObj.answers)) {
        rawOpts = mainObj.answers;
      } else if (Array.isArray(mainObj.choices)) {
        rawOpts = mainObj.choices;
      } else if (Array.isArray(mainObj.sequenceItems)) {
        rawOpts = mainObj.sequenceItems.map((item: any) => typeof item === 'string' ? item : (item.value || item.text || ''));
      } else if (Array.isArray(mainObj.matchingLeft)) {
        rawOpts = mainObj.matchingLeft.map((item: any) => typeof item === 'string' ? item : (item.value || item.text || ''));
      } else if (Array.isArray(mainObj.comparisonStatements)) {
        rawOpts = mainObj.comparisonStatements.map((item: any) => typeof item === 'string' ? item : (item.text || item.value || ''));
      }

      let detectedCorrectIdx: number | undefined = undefined;
      if (typeof mainObj.correctIndex === 'number') {
        detectedCorrectIdx = mainObj.correctIndex;
      } else if (Array.isArray(mainObj.correctAnswerIndices) && mainObj.correctAnswerIndices.length > 0) {
        detectedCorrectIdx = mainObj.correctAnswerIndices[0];
      } else if (Array.isArray(mainObj.correctIndices) && mainObj.correctIndices.length > 0) {
        detectedCorrectIdx = mainObj.correctIndices[0];
      }

      const adapted = adaptMainToTournamentSingleChoice(rawOpts, detectedCorrectIdx);
      tPayload.answers = adapted.answers;
      tPayload.correctAnswerIndices = adapted.correctAnswerIndices;
    }

    return tPayload;
  };

  const getSingleQuestionId = (num: string, block: string, slugStr: string, textStr: string, suffix: string, langStr: string) => {
    const qNum = String(parseInt(num, 10) || 1).padStart(2, '0');
    const blockPart = block ? `${block.trim().toUpperCase()}--` : '';
    const rawName = slugStr || textStr || 'q';
    const qSlug = slugify(rawName).substring(0, 15) || 'q';
    const suff = (suffix || '').trim() || Math.random().toString(36).substring(2, 6);
    return `${langStr || 'ua'}--${qNum}--${blockPart}${qSlug}--${suff}`;
  };

  const handleSingleQuestionImport = async () => {
    if (!dbInstance) {
      triggerToast('Database instance is not initialized / Відсутнє з\'єднання з БД', 'error');
      return;
    }
    if (!singleQuestionJson.trim()) {
      triggerToast('Будь ласка, завантажте файл JSON або введіть дані вручну / Please load or enter JSON data', 'error');
      return;
    }

    setSingleQuestionImporting(true);
    setSingleImportResult(null);
    try {
      const parseRes = robustParseJson(singleQuestionJson.trim());
      if (!parseRes.data) {
        triggerToast(`Невалідний JSON синтаксис${parseRes.line ? ` (рядок ${parseRes.line}, колонка ${parseRes.column})` : ''}: ${parseRes.error}`, 'error');
        setSingleQuestionImporting(false);
        return;
      }
      let questionData = parseRes.data;
      if (Array.isArray(questionData)) {
        questionData = questionData[0] || {};
      }
      if (typeof questionData !== 'object' || questionData === null) {
        triggerToast('Дані питання повинні бути JSON-об\'єктом', 'error');
        setSingleQuestionImporting(false);
        return;
      }

      // Normalize common fields for all question types so all JSON imports have identical common fields
      if (!questionData.lang) {
        questionData.lang = singleQuestionLang;
      }
      if (!Array.isArray(questionData.topics)) {
        questionData.topics = Array.isArray(questionData.tags) ? questionData.tags : [];
      }
      if (!Array.isArray(questionData.scientificDisciplines)) {
        questionData.scientificDisciplines = [];
      }
      if (typeof questionData.explanation !== 'string') {
        questionData.explanation = questionData.explanation || '';
      }
      if (!Array.isArray(questionData.recommendedLiterature)) {
        questionData.recommendedLiterature = [];
      }
      if (typeof questionData.literatureHiddenAtStart !== 'boolean') {
        if (typeof questionData.isLiteratureHiddenAtStart === 'boolean') {
          questionData.literatureHiddenAtStart = questionData.isLiteratureHiddenAtStart;
          delete questionData.isLiteratureHiddenAtStart;
        } else {
          questionData.literatureHiddenAtStart = singleQuestionLiteratureHidden;
        }
      }
      
      const category = importTarget; // We reuse category select
      const level = singleQuestionLevel;
      const lang = singleQuestionLang;
      const qNum = singleQuestionNumber;
      const block = singleQuestionBlock;
      // Get the default question text if present in the loaded JSON object
      const defaultText = questionData.question || questionData.questionText || questionData.text || '';
      const slugVal = singleQuestionSlug || defaultText || 'q';
      const suffix = singleQuestionSuffix;

      const qId = getSingleQuestionId(qNum, block, slugVal, defaultText, suffix, lang);

      // 1. Calculate resolved category e.g. quizCategory_en if lang is not ua
      const resolvedCategory = lang === 'ua' ? category : `${category}_${lang}`;
      const levelDocRef = doc(dbInstance, resolvedCategory, String(level));

      const sanitizedQuestionData = sanitizeForFirestore(questionData);

      await runTransaction(dbInstance, async (transaction) => {
        const levelSnapshot = await transaction.get(levelDocRef);
        const subcollRef = doc(collection(levelDocRef, 'questions'), qId);
        const questionSnapshot = await transaction.get(subcollRef);
        const alreadyExists = questionSnapshot.exists();
        
        if (!levelSnapshot.exists()) {
          // If level doc does not exist, set default parent values
          transaction.set(levelDocRef, {
            levelNumber: Number(level) || 1,
            subscriptionTier: 'free',
            status: 'UNLOCKED',
            questionCount: 1
          });
        } else if (!alreadyExists) {
          // Level exists: update its questionCount if it's new
          const currentLevelData = levelSnapshot.data() || {};
          const currentCount = Number(currentLevelData.questionCount) || 0;
          transaction.update(levelDocRef, {
            questionCount: currentCount + 1
          });
        }

        // 2. Also write into questions subcollection inside the Level document
        transaction.set(subcollRef, sanitizedQuestionData);
      });

      // 3. Save into Tournament collection (tournamentQuestionPools) if enabled
      let tournamentSaved = false;
      let tournamentQuestionId: string | undefined;
      let tournamentErrorMessage: string | undefined;
      if (saveSingleToTournament) {
        let tPayload: any = null;
        if (singleTournamentJson.trim()) {
          const tParseRes = robustParseJson(singleTournamentJson.trim());
          if (!tParseRes.data) {
            triggerToast(`Помилка синтаксису у Турнірному JSON${tParseRes.line ? ` (рядок ${tParseRes.line}, колонка ${tParseRes.column})` : ''}: ${tParseRes.error}`, 'error');
            setSingleQuestionImporting(false);
            return;
          }
          let parsedTourn = tParseRes.data;
          if (Array.isArray(parsedTourn)) {
            parsedTourn = parsedTourn[0] || {};
          }
          tPayload = parsedTourn;
        } else {
          tPayload = buildTournamentPayloadFromMain(questionData);
        }

        const tLang = tPayload.language || lang;
        const tCat = tPayload.categoryId || tournamentCategoryId || 'science';
        const tType = String(tPayload.type || 'SINGLE_CHOICE').toUpperCase().trim();
        const tDiff = Number(tPayload.difficulty) || tournamentDifficulty || 2;

        tPayload.type = tType;
        tPayload.language = tLang;
        tPayload.categoryId = tCat;
        tPayload.difficulty = tDiff;
        tPayload.sourcePath = `${resolvedCategory}/${level}/questions/${qId}`;
        tPayload.sourceVersion = Number(tPayload.sourceVersion) || 1;
        tPayload.explanation = tPayload.explanation || questionData.explanation || null;

        try {
          if (!authInstance) throw new Error('Firebase Auth не ініціалізовано.');
          const result = await publishTournamentQuestion(authInstance, tPayload);
          tournamentSaved = true;
          tournamentQuestionId = result.questionId;
        } catch (tournamentError: any) {
          console.error('Tournament publication failed:', tournamentError);
          tournamentErrorMessage = tournamentError?.message || 'Невідома помилка публікації турнірного питання.';
        }
      }

      setSingleImportResult({
        mainQuestionId: qId,
        tournamentQuestionId,
        tournamentError: tournamentErrorMessage
      });

      if (tournamentSaved) {
        triggerToast(
          `Основне питання (${qId}) і турнірна копія (${tournamentQuestionId}) успішно збережені.`,
          'success'
        );
      } else if (tournamentErrorMessage) {
        triggerToast(
          `Основне питання збережено, але турнірну копію не опубліковано: ${tournamentErrorMessage}`,
          'error'
        );
      } else {
        triggerToast(`Питання успішно імпортовано! ID: ${qId}`, 'success');
      }

      // Refresh list if we are viewing this collection right now
      if (activeCol === resolvedCategory) {
        fetchDocuments();
      }

      // AFTER LOADING FILE / UPLOAD SUCCESS: INCREMENT +1 (після завантаження файлу +1)
      const nextNum = parseInt(qNum, 10) + 1;
      updateSingleQuestionNumber(String(nextNum).padStart(1, '0'));

      // Regen random suffix to avoid collisions on subsequent imports
      setSingleQuestionSuffix(Math.random().toString(36).substring(2, 6));

    } catch (err: any) {
      console.error(err);
      triggerToast(`Помилка імпорту питання: ${err.message}`, 'error');
    } finally {
      setSingleQuestionImporting(false);
    }
  };

  const [singleTournamentImporting, setSingleTournamentImporting] = useState(false);

  const handleSingleTournamentOnlyImport = async () => {
    if (!dbInstance) {
      triggerToast('Database instance is not initialized / Відсутнє з\'єднання з БД', 'error');
      return;
    }

    setSingleTournamentImporting(true);
    setSingleImportResult(null);
    try {
      let tPayload: any = null;
      let qId = '';
      let defaultQuestionText = '';

      if (singleTournamentJson.trim()) {
        const tParseRes = robustParseJson(singleTournamentJson.trim());
        if (!tParseRes.data) {
          triggerToast(`Помилка синтаксису у Турнірному JSON${tParseRes.line ? ` (рядок ${tParseRes.line}, колонка ${tParseRes.column})` : ''}: ${tParseRes.error}`, 'error');
          setSingleTournamentImporting(false);
          return;
        }
        let parsedTourn = tParseRes.data;
        if (Array.isArray(parsedTourn)) {
          parsedTourn = parsedTourn[0] || {};
        }
        tPayload = parsedTourn;
        defaultQuestionText = tPayload.question || '';
      } else if (singleQuestionJson.trim()) {
        const parseRes = robustParseJson(singleQuestionJson.trim());
        if (!parseRes.data) {
          triggerToast(`Невалідний основний JSON синтаксис${parseRes.line ? ` (рядок ${parseRes.line}, колонка ${parseRes.column})` : ''}: ${parseRes.error}`, 'error');
          setSingleTournamentImporting(false);
          return;
        }
        let questionData = parseRes.data;
        if (Array.isArray(questionData)) questionData = questionData[0] || {};
        tPayload = buildTournamentPayloadFromMain(questionData);
        defaultQuestionText = questionData.question || questionData.text || '';
      } else {
        triggerToast('Будь ласка, введіть або завантажте Основний або Турнірний JSON', 'error');
        setSingleTournamentImporting(false);
        return;
      }

      qId = tPayload.id || getSingleQuestionId(
        singleQuestionNumber,
        singleQuestionBlock,
        singleQuestionSlug,
        defaultQuestionText,
        singleQuestionSuffix,
        singleQuestionLang
      );

      const tLang = tPayload.language || singleQuestionLang || 'ua';
      const tCat = tPayload.categoryId || tournamentCategoryId || 'science';
      const tType = String(tPayload.type || 'SINGLE_CHOICE').toUpperCase().trim();
      const tDiff = Number(tPayload.difficulty) || tournamentDifficulty || 2;
      const resolvedCategory = tLang === 'ua' ? importTarget : `${importTarget}_${tLang}`;

      tPayload.type = tType;
      tPayload.language = tLang;
      tPayload.categoryId = tCat;
      tPayload.difficulty = tDiff;
      tPayload.sourcePath = tPayload.sourcePath || `${resolvedCategory}/${singleQuestionLevel}/questions/${qId}`;
      tPayload.sourceVersion = Number(tPayload.sourceVersion) || 1;

      if (!authInstance) throw new Error('Firebase Auth не ініціалізовано.');
      const result = await publishTournamentQuestion(authInstance, tPayload);

      setSingleImportResult({ tournamentQuestionId: result.questionId });
      triggerToast(
        `Турнірне питання збережено: tournamentQuestionPools/${result.questionId}`,
        'success'
      );

      if (activeCol === 'tournamentQuestionPools') {
        fetchDocuments();
      }
    } catch (err: any) {
      console.error('Error importing tournament question directly:', err);
      const message = err?.message || 'Невідома помилка публікації турнірного питання.';
      setSingleImportResult({ tournamentError: message });
      triggerToast(`Турнірне питання не збережено: ${message}`, 'error');
      handleFirestoreError(err, OperationType.WRITE, `tournamentQuestionPools`, authInstance);
    } finally {
      setSingleTournamentImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-3 left-3 right-3 sm:left-auto sm:right-4 z-50 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl shadow-xl border text-xs sm:text-sm max-w-md ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            )}
            <span className="font-medium break-words leading-tight">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-3 sm:px-6 py-2 sm:py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2 sm:gap-3 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full xl:w-auto min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
            {/* Mobile Drawer Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="md:hidden p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer shrink-0"
              title="Шляхи / Колекції"
            >
              <FolderOpen className="h-4 w-4 text-amber-600" />
            </button>

            <div className="bg-amber-500 text-white p-1.5 sm:p-2 rounded-xl shadow-inner flex items-center justify-center shrink-0">
              <Database className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-base font-bold tracking-tight text-slate-950 flex items-center gap-1.5">
                <span className="truncate">Firestore Manager</span>
                <span className="text-[9px] sm:text-[10px] bg-amber-100 text-amber-800 font-medium px-1.5 py-0.2 rounded whitespace-nowrap shrink-0">
                  Safe ABAC
                </span>
              </h1>
              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                <span className="text-[10px] sm:text-xs text-slate-500 font-bold shrink-0">Проект:</span>
                <select
                  value={activeConnId}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    if (selectedVal === 'ADD_NEW') {
                      setActiveTab('credentials');
                      setShowNewConn(true);
                    } else {
                      setActiveConnId(selectedVal);
                      const targetConn = connections.find(c => c.id === selectedVal);
                      triggerToast(`Переключено на проект: ${targetConn?.name || selectedVal}`);
                    }
                  }}
                  className="bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] sm:text-xs px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] truncate shadow-2xs"
                  title="Оберіть підключену базу даних Firestore або додайте власний проект"
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isLocal ? '⚡ ' : '🌐 '}{c.name} ({c.config.projectId})
                    </option>
                  ))}
                  <option value="ADD_NEW">+ Імпортувати власний проект...</option>
                </select>
              </div>
            </div>
          </div>

          {/* Active Connection state indicator for mobile right */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-md text-[10px] font-mono shrink-0 font-medium sm:hidden">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Connected</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between xl:justify-end gap-1.5 sm:gap-2.5 w-full xl:w-auto">
          {/* Active Connection state indicator for sm+ */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg text-xs font-mono shrink-0 font-medium">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Connected (Підключено)</span>
          </div>

          {/* User auth badge */}
          {authChecking ? (
            <div className="animate-spin text-slate-400 shrink-0">
              <RefreshCw className="h-4 w-4" />
            </div>
          ) : currentUser ? (
            <div className="flex items-center gap-2 bg-slate-950 text-slate-200 pl-2 pr-2.5 py-1 rounded-lg text-xs font-medium border border-slate-800 shrink-0 shadow-md">
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="User Avatar" className="h-5 w-5 rounded-md" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-5 w-5 rounded-md bg-amber-500 text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0">
                  {currentUser.email?.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className="max-w-[100px] sm:max-w-[140px] truncate font-semibold text-slate-100" title={currentUser.email || undefined}>
                  {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono select-all flex items-center gap-1" title="User ID (UID) - Клацніть для копіювання">
                  UID: <span className="text-amber-400 font-bold">{currentUser.uid.slice(0, 5)}...</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentUser.uid);
                      setUidCopied(true);
                      setTimeout(() => setUidCopied(false), 2000);
                      triggerToast('UID користувача скопійовано в буфер обміну!', 'success');
                    }}
                    className="hover:text-amber-300 p-0.5 rounded transition duration-200 focus:outline-none cursor-pointer"
                    title={`Копіювати повний UID: ${currentUser.uid}`}
                  >
                    {uidCopied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                  </button>
                </span>
              </div>
              <button
                onClick={handleSignOut}
                title="Sign out / Вийти"
                className="hover:text-red-400 ml-1 p-1 rounded hover:bg-slate-900 transition duration-200 cursor-pointer text-slate-400 self-center shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={handleToggleBypassAuth}
                className={`flex items-center gap-1 hover:scale-[1.02] active:scale-[0.98] px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg shadow-sm border transition cursor-pointer ${
                  bypassAuth
                    ? 'bg-emerald-500 text-slate-950 border-emerald-600 font-bold'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Bypass login step. Use this if your Firestore security rules are open or if Google Sign-In is not initialized/authorized yet."
              >
                Guest: {bypassAuth ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={handleSignIn}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-semibold px-2.5 py-1 text-[11px] sm:text-xs rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" />
                Google Login
              </button>
            </div>
          )}

          {/* Tab Navigation buttons */}
          <nav className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto scrollbar-none [scrollbar-width:none] shrink-0 w-full xl:w-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <button
              onClick={() => setActiveTab('constructor')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'constructor'
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Noesis Конструктор
            </button>
            <button
              onClick={() => { setActiveTab('explorer'); fetchDocuments(); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'explorer'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Провідник (Explorer)
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Імпорт/Експорт JSON
            </button>
            <button
              onClick={() => setActiveTab('credentials')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition shrink-0 whitespace-nowrap cursor-pointer ${
                activeTab === 'credentials'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Проекти
            </button>
          </nav>
        </div>
      </header>

      {/* Troubleshooting and Auth Help Banner (Помилка доменів авторизації) */}
      {lastAuthError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-start gap-3 text-xs text-red-800">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-650 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-red-950 mb-1">Помилка авторизації / Authentication Error:</p>
            <p className="font-mono bg-white/80 p-2.5 rounded border border-red-100 max-w-full overflow-x-auto text-[11px] mb-2 text-red-700">
              {lastAuthError}
            </p>
            {lastAuthError.includes('unauthorized-domain') && (
              <div className="text-slate-800 mt-2 space-y-3 bg-white p-4 rounded-xl border border-red-200/60 shadow-xs max-w-4xl">
                <p className="font-semibold text-red-900 text-[13px]">
                  ⚠️ Чому виникає помилка "auth/unauthorized-domain" і як її виправити:
                </p>
                <p className="text-[11px] text-slate-650 leading-relaxed">
                  Судячи з вашого скріншоту, ви додали довірені домени в проекті з назвою <strong className="text-slate-905 bg-slate-100 px-1.5 py-0.5 rounded font-mono">noesis (QuizForge)</strong>, проте конфігурація Firebase, яку ви імпортували в цей менеджер, належить зовсім іншому проекту — <strong className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-mono font-bold">{activeConn?.config.projectId}</strong>!
                </p>
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-250/70 text-slate-705">
                  <p className="font-bold text-slate-900 mb-1.5 text-[12px]">Кроки для швидкого вирішення:</p>
                  <ol className="list-decimal pl-5 space-y-2 text-[11px] text-slate-650">
                    <li>
                      Перейдіть у консоль Firebase: <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-650 hover:underline font-bold inline-flex items-center gap-0.5">console.firebase.google.com <ExternalLink className="h-3 w-3" /></a>
                    </li>
                    <li>
                      У лівому верхньому куті натисніть на вибір проектів та <strong>переключіться на проект {activeConn?.config.projectId}</strong> (або знайдіть його у списку розкривного меню).
                    </li>
                    <li>
                      Перейдіть в меню <strong>Authentication ➜ Settings ➜ Authorized domains</strong> та додайте туди ці два домени:
                      <div className="font-mono bg-slate-900 text-slate-100 p-2 rounded.md mt-1.5 select-all space-y-0.5 text-[10px] border border-slate-700">
                        <div>ais-dev-2g4gkt46rtau5mz43enpli-309821893240.europe-west2.run.app</div>
                        <div>ais-pre-2g4gkt46rtau5mz43enpli-309821893240.europe-west2.run.app</div>
                      </div>
                    </li>
                    <li>
                      <strong>АБО використовуючи проект "noesis":</strong> Якщо ви хочете підключити саме "noesis", то перейдіть у вкладку <strong>Projects (Проекти)</strong> у верхньому правому куті, натисніть "Додати проект" та вставте туди Firebase Web Config від проекту <strong>noesis</strong>!
                    </li>
                  </ol>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-1">
                  <button
                    onClick={() => { setLastAuthError(null); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition cursor-pointer"
                  >
                    Зрозуміло / Clear Warning
                  </button>
                  <button
                    onClick={() => { handleToggleBypassAuth(); setLastAuthError(null); }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-[11px] transition shadow-xs cursor-pointer"
                  >
                    Увімкнути "Режим гостя" (Guest Mode) ➜
                  </button>
                </div>
              </div>
            )}
            {(lastAuthError.includes('api-key-not-valid') || lastAuthError.includes('auth/api-key-not-valid')) && (
              <div className="text-slate-800 mt-2 space-y-3 bg-white p-4 rounded-xl border border-amber-200 shadow-xs max-w-4xl">
                <p className="font-semibold text-amber-900 text-[13px]">
                  ℹ️ Служба Firebase Auth не активована для поточного ключа (auth/api-key-not-valid)
                </p>
                <p className="text-[11px] text-slate-650 leading-relaxed">
                  Для поточного ключа API в провайдері Firebase не налаштовано або обмежено сервіс авторизації Google Sign-In.
                  <br />
                  <strong className="text-emerald-700">Автоматично активовано "Режим гостя" (Bypass Mode)</strong>, що дозволяє створювати, переглядати та редагувати колекції і документи у Firestore без перешкод.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => { setLastAuthError(null); }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-[11px] transition cursor-pointer"
                  >
                    Зрозуміло / Clear Warning
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        
        {/* Mobile Backdrop Overlay when Sidebar is open */}
        {!sidebarCollapsed && (
          <div 
            className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-30 transition-opacity"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        {/* Left Control Sidebar */}
        <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col ${
          sidebarCollapsed 
            ? 'hidden md:flex w-16 p-3 gap-4 items-center shrink-0 z-20' 
            : 'fixed inset-y-0 left-0 z-40 w-[280px] sm:w-80 p-4 sm:p-6 gap-4 sm:gap-6 shadow-2xl md:shadow-none md:relative md:inset-auto md:z-20 shrink-0'
        }`}>
          
          {/* Header & Toggle row */}
          <div className={`flex w-full ${sidebarCollapsed ? 'flex-col items-center gap-3' : 'items-center justify-between'}`}>
            {!sidebarCollapsed && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
                📁 Workspace (Робочий простір)
              </span>
            )}
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "Розгорнути робочий простір (Expand)" : "Згорнути робочий простір (Collapse)"}
              className={`p-1 px-1.5 hover:bg-slate-100 text-slate-505 rounded border border-slate-200 transition cursor-pointer flex items-center justify-center gap-1 shrink-0 ${sidebarCollapsed ? 'w-10 h-10' : ''}`}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="h-4 w-4" />
              ) : (
                <>
                  <ChevronsLeft className="h-4 w-4" />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Згорнути</span>
                </>
              )}
            </button>
          </div>

          {/* Active Work Project database dropdown info card */}
          {!sidebarCollapsed ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Project Workspace (Робочий простір)</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                  Active (Активний)
                </span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-xs truncate max-w-xs">{activeConn.name}</p>
                <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">ID: {activeConn.config.projectId}</p>
              </div>
              {activeConn.isLocal && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                  <Info className="h-3 w-3 shrink-0" /> Local Provisioned Sandbox (Локальна пісочниця)
                </span>
              )}
              <button
                onClick={() => setActiveTab('credentials')}
                className="mt-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 font-medium py-1.5 text-xs rounded-lg border border-slate-200 transition cursor-pointer w-full"
              >
                <Settings className="h-3.5 w-3.5" /> Manage Connections (Керування підключеннями)
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab('credentials')}
              title={`Connection: ${activeConn.name} / ID: ${activeConn.config.projectId} - Click to manage connections`}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition text-slate-600 hover:text-slate-950 shadow-2xs hover:scale-105 shrink-0"
            >
              <Database className="h-4 w-4" />
            </button>
          )}

          {/* Collections monitor sidebar section */}
          <div className="flex flex-col gap-3 flex-1 overflow-y-auto w-full">
            {!sidebarCollapsed ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Monitored Paths (Шляхи відстеження)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {collectionsList.length} paths ({collectionsList.length} шляхів)
                </span>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-2 w-full text-center">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Шляхи</span>
              </div>
            )}

            {/* Path Addition Field */}
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  value={newColInput}
                  onChange={e => setNewColInput(e.target.value)}
                  placeholder="e.g. users or products (напр., users або products)"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCollectionPath(); }}
                  className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleAddCollectionPath()}
                  title="Add new collection path to monitor list / Додати новий шлях колекції до списку"
                  className="bg-amber-500 hover:bg-amber-600 hover:scale-105 active:scale-95 text-slate-950 p-2 rounded-lg transition shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  toggleSidebar();
                }}
                title="Add monitored path (Розгорнути для додавання)"
                className="w-10 h-10 flex items-center justify-center bg-amber-500 hover:bg-amber-600 hover:scale-105 active:scale-95 text-slate-950 rounded-full transition shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}

            {/* List */}
            <div className={`flex flex-col gap-1 overflow-y-auto pr-1 ${
              sidebarCollapsed 
                ? 'scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full items-center' 
                : ''
            }`}>
              {collectionsList.map(pathStr => {
                const folderColClass = getFolderColorClass(pathColors[pathStr]);
                return (
                  <div
                    key={pathStr}
                    onClick={() => {
                      setActiveCol(pathStr);
                      setImportTarget(pathStr);
                      localStorage.setItem('noesis_category', pathStr);
                      setActiveTab('explorer');
                    }}
                    title={pathStr}
                    className={`flex items-center text-left rounded-lg text-xs transition relative cursor-pointer ${
                      sidebarCollapsed
                        ? `w-10 h-10 justify-center p-0 rounded-full border ${
                            activeCol === pathStr
                              ? 'bg-amber-100 border-amber-500 shadow-sm font-bold'
                              : 'bg-white hover:bg-slate-50 border-slate-100'
                          }`
                        : `w-full justify-between px-3 py-2.5 ${
                            activeCol === pathStr
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-100'
                          }`
                    }`}
                  >
                    {sidebarCollapsed ? (
                      <FolderOpen className={`h-5 w-5 ${folderColClass}`} />
                    ) : (
                      <>
                        <span className="truncate flex items-center gap-2">
                          <FolderOpen className={`h-3.5 w-3.5 shrink-0 ${folderColClass}`} />
                          <span className="truncate max-w-[130px]">{pathStr}</span>
                        </span>
                        
                        {/* Right side controls: path palette + path trash */}
                        <div className="flex items-center gap-1.5 shrink-0" onClick={ev => ev.stopPropagation()}>
                          {activeColorPickerPath === pathStr ? (
                            <div className="flex items-center gap-0.5 bg-slate-50 border border-slate-200 p-1 rounded-md shadow-xs" onClick={ev => ev.stopPropagation()}>
                              {['amber', 'orange', 'emerald', 'blue', 'violet', 'rose', 'slate'].map(colorOpt => (
                                <button
                                  key={colorOpt}
                                  type="button"
                                  title={colorOpt}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    updatePathColor(pathStr, colorOpt);
                                    setActiveColorPickerPath(null);
                                  }}
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    colorOpt === 'amber' ? 'bg-amber-500' :
                                    colorOpt === 'orange' ? 'bg-orange-500' :
                                    colorOpt === 'emerald' ? 'bg-emerald-500' :
                                    colorOpt === 'blue' ? 'bg-blue-500' :
                                    colorOpt === 'violet' ? 'bg-violet-500' :
                                    colorOpt === 'rose' ? 'bg-rose-500' : 'bg-slate-400'
                                  } hover:scale-125 transition-transform border border-white`}
                                />
                              ))}
                              <button
                                type="button"
                                onClick={(ev) => { ev.stopPropagation(); setActiveColorPickerPath(null); }}
                                className="text-slate-400 hover:text-slate-600 text-[9px] font-bold px-0.5"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                              {/* Small color circle trigger */}
                              <button
                                type="button"
                                title="Change folder color (Змінити колір папки)"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setActiveColorPickerPath(pathStr);
                                }}
                                className="p-1 hover:bg-slate-200 rounded-md"
                              >
                                <span className={`block h-2.5 w-2.5 rounded-full border border-slate-350 ${
                                  pathColors[pathStr] === 'orange' ? 'bg-orange-500' :
                                  pathColors[pathStr] === 'emerald' ? 'bg-emerald-500' :
                                  pathColors[pathStr] === 'blue' ? 'bg-blue-500' :
                                  pathColors[pathStr] === 'violet' ? 'bg-violet-500' :
                                  pathColors[pathStr] === 'rose' ? 'bg-rose-500' :
                                  pathColors[pathStr] === 'slate' ? 'bg-slate-500' : 'bg-amber-500'
                                }`} />
                              </button>
                              
                              <button
                                type="button"
                                onClick={(ev) => handleRemoveCollectionPath(pathStr, ev)}
                                className={`p-1 hover:bg-slate-200 rounded-md transition ${activeCol === pathStr ? 'text-slate-800 hover:text-red-900' : 'text-slate-400 hover:text-red-700'}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Outer body for main tab outputs */}
        <main className="flex-1 bg-slate-50 p-3 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-y-auto w-full min-w-0">
          
          {/* TAB 0: NOESIS CONSTRUCTOR VIEW */}
          {activeTab === 'constructor' && (
            <Suspense fallback={<LazyPanelFallback />}>
              <NoesisConstructor
                dbInstance={dbInstance}
                authInstance={authInstance}
                bypassAuth={bypassAuth}
                activeConn={activeConn}
                onOpenCredentials={() => {
                  setActiveTab('credentials');
                  setShowNewConn(true);
                }}
                triggerToast={triggerToast}
                onRefreshExplorer={fetchDocuments}
                loadRequest={loadRequest}
                clearLoadRequest={() => setLoadRequest(null)}
                sharedLang={singleQuestionLang}
                setSharedLang={(val) => {
                  setSingleQuestionLang(val);
                  localStorage.setItem('noesis_lang', val);
                }}
                sharedCategory={activeCol}
                setSharedCategory={(val) => {
                  setActiveCol(val);
                  setImportTarget(val);
                  localStorage.setItem('noesis_category', val);
                }}
                sharedLevel={singleQuestionLevel}
                setSharedLevel={(val) => {
                  setSingleQuestionLevel(val);
                  localStorage.setItem('noesis_level', String(val));
                }}
                sharedQuestionNumber={singleQuestionNumber}
                setSharedQuestionNumber={(val) => {
                  updateSingleQuestionNumber(val);
                }}
                sharedBlockIdentifier={singleQuestionBlock}
                setSharedBlockIdentifier={(val) => {
                  setSingleQuestionBlock(val);
                  localStorage.setItem('noesis_block', val);
                }}
              />
            </Suspense>
          )}

          {/* TAB 1: EXPLORER VIEW */}
          {activeTab === 'explorer' && (
            <div className="flex-1 flex flex-col gap-6">
              
              {/* Query & Search constraints control panel */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <h3 className="font-bold text-slate-950 text-sm">Query Filter Panel (Панель фільтрів запиту)</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">Document Query Limit (Ліміт запиту):</span>
                    <select
                      value={queryLimit}
                      onChange={(e) => setQueryLimit(Number(e.target.value))}
                      className="bg-slate-50 border border-slate-200 py-1 px-2.5 rounded text-xs focus:ring-1 focus:ring-amber-500 font-mono text-slate-700"
                    >
                      <option value="15">15 rows (рядків)</option>
                      <option value="30">30 rows (рядків)</option>
                      <option value="50">50 rows (рядків)</option>
                      <option value="100">100 rows (рядків)</option>
                    </select>
                    <button
                      onClick={fetchDocuments}
                      title="Fresh query run / Оновити запит"
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1 rounded transition cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Adding Query components */}
                <div className="flex flex-col gap-4">
                  {/* Row 1: Field, Op, Type (Red Box grouping principle) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Field identifier (Поле)</label>
                      <input
                        type="text"
                        value={newFilterField}
                        onChange={e => setNewFilterField(e.target.value)}
                        placeholder="e.g. age, status (напр., age, status)"
                        className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operator (Оператор)</label>
                      <select
                        value={newFilterOp}
                        onChange={e => setNewFilterOp(e.target.value as any)}
                        className="text-xs bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      >
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<=">&lt;=</option>
                        <option value="array-contains">array-contains</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">DataType (Тип даних)</label>
                      <select
                        value={newFilterType}
                        onChange={e => setNewFilterType(e.target.value as any)}
                        className="text-xs bg-slate-50 border border-slate-200 px-2 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      >
                        <option value="string">string (рядок)</option>
                        <option value="number">number (число)</option>
                        <option value="boolean">boolean (булеве)</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Value & Button (Blue Box grouping principle) */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="flex flex-col gap-1.5 md:col-span-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Value (Значення)</label>
                      <input
                        type="text"
                        value={newFilterVal}
                        onChange={e => setNewFilterVal(e.target.value)}
                        placeholder="e.g. true or 15 or text"
                        className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <button
                        onClick={handleAddQueryFilter}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4 rounded-lg flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer h-9 shadow-xs"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" /> Add constraint (Додати обмеження)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filters breadcrumbs */}
                {queryFilters.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Applied limits (Застосовані обмеження):</span>
                    {queryFilters.map((f, i) => (
                      <span key={i} className="bg-amber-100 text-amber-900 text-[11px] font-mono font-medium pl-2.5 pr-1.5 py-1 rounded-md flex items-center gap-1 border border-amber-200">
                        {f.field} {f.operator} <span className="font-semibold text-amber-950">"{f.value}"</span> ({f.valueType})
                        <button
                          onClick={() => setQueryFilters(queryFilters.filter((_, idx) => idx !== i))}
                          className="hover:bg-amber-200 p-0.5 rounded text-amber-900 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={handleClearFilters}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-900 hover:underline ml-auto bg-white px-2 py-0.5 rounded border border-slate-200 transition"
                    >
                      Clear All Filters (Очистити всі фільтри)
                    </button>
                  </div>
                )}
              </div>

              {/* Show Document Query operation issues / Missing Permission logs nicely */}
              {docOperationError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-850 p-5 rounded-2xl flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-2 text-rose-900 font-bold font-mono text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 animate-pulse" />
                    <span>FIRESTORE RULES / RETRIEVAL WARNING (ПОПЕРЕДЖЕННЯ ПРАВИЛ/ОТРИМАННЯ FIRESTORE)</span>
                  </div>
                  
                  <pre className="text-[11px] bg-rose-100 text-rose-950 p-3 rounded-lg overflow-x-auto font-mono select-all border border-rose-200">
                    {docOperationError}
                  </pre>

                  {/* Smart detection of custom external production / sandbox permissions query */}
                  {(!activeConn?.isLocal || docOperationError.toLowerCase().includes('permission') || docOperationError.toLowerCase().includes('insufficient')) ? (
                    <div className="bg-white p-4.5 rounded-xl border border-rose-200/60 text-slate-800 space-y-3 mt-1 shadow-2xs">
                      <p className="font-bold text-[13px] text-red-900 flex items-center gap-1.5">
                        <span>⚠️</span> Чому виникає помилка "Missing or insufficient permissions" і як її виправити:
                      </p>
                      
                      <p className="text-[11.5px] text-slate-650 leading-relaxed">
                        Ви підключені до <strong>{activeConn?.isLocal ? 'локальної пісочниці' : 'власного проекту'}</strong> з назвою <strong className="text-slate-900 font-bold">"{activeConn?.name}"</strong> (ID проекту: <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-700 font-mono text-[10.5px] font-bold">{activeConn?.config.projectId}</code>).
                      </p>

                      {!activeConn?.isLocal ? (
                        <div className="text-[11.5px] text-slate-650 space-y-2">
                          <p className="bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-200/75 font-medium">
                            📌 <strong>Важливе правило архітектури:</strong> Оскільки ви додали <strong>власну конфігурацію Firebase</strong>, локальні файли в цьому редакторі (наприклад, файл <code className="font-mono bg-white px-1 border rounded">firestore.rules</code>) <strong>не можуть</strong> автоматично змінити правила безпеки всередині вашої реальної консолі Google/Firebase. Вам потрібно змінити їх самостійно.
                          </p>
                          
                          <p className="font-semibold text-slate-850 mt-2">Крок-за-кроком, що потрібно зробити зараз:</p>
                          <ol className="list-decimal pl-5 space-y-2 text-slate-650 text-[11px]">
                            <li>
                              Відкрийте вашу консоль Firebase: <a href={`https://console.firebase.google.com/project/${activeConn?.config.projectId}/firestore/rules`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold inline-flex items-center gap-0.5">Перейти до правил Firestore <ExternalLink className="h-3 w-3" /></a>
                            </li>
                            <li>
                              Знайдіть вкладку <strong>Rules (Правила)</strong>.
                            </li>
                            <li>
                              Замініть або доповніть правила наступним кодом, щоб дозволити читання/запис для розробки:
                              <div className="relative group mt-1.5">
                                <pre className="font-mono bg-slate-900 text-emerald-400 p-3 rounded-lg text-[10px] select-all border border-slate-800 whitespace-pre overflow-x-auto leading-relaxed max-w-full">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Дозволяємо читання та запис для будь-яких колекцій в тестовому режимі
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                                </pre>
                                <div className="absolute right-2 top-2">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`);
                                      triggerToast('Код правил скопійовано! (Rules copied!)', 'success');
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-[10px] px-2 py-1 rounded border border-slate-700 transition cursor-pointer font-bold"
                                  >
                                    Скопіювати правила (Copy)
                                  </button>
                                </div>
                              </div>
                            </li>
                            <li>
                              Натисніть велику синю кнопку <strong>"Publish" (Опублікувати)</strong> у верхньому правому куті консолі Firebase.
                            </li>
                            <li>
                              Зачекайте 1-2 хвилини, поки Firebase оновить конфігурацію, та натисніть кнопку оновлення списку або перезавантажте сторінку тут!
                            </li>
                          </ol>
                        </div>
                      ) : (
                        <div className="text-[11.5px] text-slate-650 space-y-2">
                          <p>
                            Оскільки це локальна пісочниця, ви можете натиснути кнопку <strong>"Розгорнути правила" (Deploy Rules)</strong> у вашому інтерфейсі, або перевірити, чи увійшли ви у правильний акаунт Google з відповідними правами доступу.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}

                  <p className="text-[10px] text-slate-500 pt-1.5 border-t border-rose-200/50">
                    * Make sure you generated policies inside <strong>firestore.rules</strong> and authenticate using Google accounts which have access privileges to selected databases.
                    <br />
                    * Переконайтеся, що ви налаштували правила у <strong>firestore.rules</strong> та увійшли через Google-акаунт, який має права доступу до обраних баз даних.
                  </p>
                </div>
              )}

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Documents Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-[200px] flex-1">
                      <h3 className="font-bold text-slate-950 text-sm">Documents inside "{activeCol}" (Документи в "{activeCol}")</h3>
                      <p className="text-xs text-slate-500">
                        Query returned {documents.length} objects. 
                        <span className="text-amber-600 font-semibold block mt-0.5">💡 Натисніть на документ рівня нижче, щоб переглянути список його питань та завантажити в конструктор для зміни.</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        onClick={handleExportCollection}
                        title="Download cached items as JSON / Завантажити збережені записи у форматі JSON"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 p-2 rounded-lg transition border border-slate-200 cursor-pointer flex items-center gap-1 text-xs font-semibold shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" /> Export Page (Експорт сторінки)
                      </button>
                      <button
                        onClick={() => setIsAddingDoc(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition shadow-sm cursor-pointer shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add row (Додати рядок)
                      </button>
                    </div>
                  </div>

                  {loadingDocs ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
                      <span className="text-xs font-medium font-mono">Quering collections... (Запит до колекцій...)</span>
                    </div>
                  ) : !currentUser ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-4 text-slate-400">
                      <div className="bg-amber-50 hover:bg-amber-100 p-4 rounded-2xl inline-flex text-amber-600 transition">
                        <Database className="h-8 w-8 text-amber-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-800">Administrator Access Required (Необхідно увійти як адміністратор)</p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        This connections workspace is secured. Please authenticate as <strong>ivan555211992@gmail.com</strong> to view and administer database paths.
                        <br />
                        <span className="text-slate-400 text-[11px]">Цей робочий простір захищено. Будь ласка, увійдіть як <strong>ivan555211992@gmail.com</strong> для перегляду та керування базом даних.</span>
                      </p>
                      <button
                        onClick={handleSignIn}
                        className="mt-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-4 py-2 text-xs rounded-lg transition shadow-sm cursor-pointer inline-flex items-center gap-2"
                      >
                        <LogIn className="h-4 w-4" /> Sign In with Google (Увійти через Google)
                      </button>
                    </div>
                  ) : documents.length === 0 ? (
                    <div className="p-16 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
                      <FolderOpen className="h-10 w-10 text-slate-300" />
                      <p className="text-sm font-semibold text-slate-700">No documents in this pathway (Немає документів за цим шляхом)</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        No items match your constraints, the database path is empty, or permission requires specific user auth fields.
                        <br />
                        <span className="text-slate-400">Жоден елемент не відповідає фільтрам, шлях у базі порожній або доступ вимагає особливих полів авторизації користувача.</span>
                      </p>
                      <button
                        onClick={() => setIsAddingDoc(true)}
                        className="mt-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-semibold px-4 py-2 text-xs rounded-lg transition"
                      >
                        Add your first Document (Додати перший документ)
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                      {documents.map((docItem) => {
                        const matchedT = detectQuestionTemplate(docItem.data);
                        const colors = matchedT ? getQuestionTypeColors(matchedT.id) : null;
                        const isSelected = selectedDoc?.id === docItem.id;

                        let borderClass = 'border-l-4 border-amber-500';
                        if (matchedT && colors) {
                          borderClass = `border-l-4 ${colors.border}`;
                        }

                        return (
                          <div
                            key={docItem.id}
                            onClick={() => openDocDetails(docItem)}
                            className={`p-4 flex items-center justify-between text-left transition cursor-pointer ${
                              isSelected
                                ? matchedT && colors
                                  ? `${colors.bg} ${borderClass} font-semibold shadow-2xs`
                                  : 'bg-amber-50/50 border-l-4 border-amber-500 font-semibold shadow-2xs'
                                : 'hover:bg-slate-50 border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`font-mono font-bold text-xs ${isSelected ? 'text-slate-900' : 'text-slate-700'} truncate`} title={docItem.id}>
                                  id: {docItem.id}
                                </span>
                                {matchedT && colors && (
                                  <span className={`text-[8.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded border leading-none scale-[0.95] ${colors.badge}`}>
                                    {matchedT.nameUk.split('(')[0].trim()}
                                  </span>
                                )}
                              </div>
                              
                              {/* Fast data sneakpeak */}
                              <div className="text-[11px] text-slate-500 font-mono mt-1.5 shrink-0 truncate max-w-md">
                                {Object.entries(docItem.data).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="mr-3">
                                    <strong className="text-slate-600">{k}:</strong> {formatFirestoreValue(v).text.slice(0, 35)}
                                  </span>
                                ))}
                                {Object.keys(docItem.data).length > 3 && (
                                  <span className="text-amber-600 font-semibold text-[10.5px]">+{Object.keys(docItem.data).length - 3} more</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                              <button
                                onClick={(e) => handleDeleteDocument(docItem.id, e)}
                                className="p-1 px-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right Interactive Drawer Panel */}
                <div className="flex flex-col gap-6">
                  
                  {/* Document details / editor form */}
                  {selectedDoc ? (
                    <motion.div
                      layoutId="doc-editor"
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="min-w-0">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 block">Active Record (Активний запис)</span>
                          <span className="text-[10px] text-slate-400 font-mono select-none">Колекція: {activeCol}/</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(null)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-400 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Nested Noesis Questions Drill-down Panel */}
                      {(() => {
                        const qGroups = getNestedQuestions(selectedDoc.data);
                        const totalMappedQs = qGroups.reduce((acc, g) => acc + g.questions.length, 0);
                        const totalSubcolQs = subcollectionQuestions.length;
                        
                        if (totalMappedQs === 0 && totalSubcolQs === 0 && !isFetchingSubcollection) {
                          return (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-2 shadow-2xs text-center">
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-center gap-1">
                                <Layers className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                Питання на Рівні
                              </span>
                              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                На цьому рівні ще не виявлено питань. Ви можете створити та зберегти нові питання через вкладку **"Конструктор"**.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="bg-slate-50 border border-slate-205 p-3 rounded-xl flex flex-col gap-2 shadow-2xs">
                            <div className="flex items-center justify-between border-b pb-1.5 border-slate-200">
                              <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                                <Layers className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                Питання на Рівні ({totalMappedQs + totalSubcolQs})
                              </span>
                              <span className="text-[8.5px] text-slate-400 font-bold tracking-tight bg-slate-200/50 px-1.5 py-0.5 rounded border border-slate-300/30">CMS Noesis DB</span>
                            </div>
                            
                            <p className="text-[9.5px]/[1.3] text-slate-400 font-medium">
                              Оберіть питання зі списку нижче, щоб автоматично завантажити його дані в конструктор для миттєвого редагування.
                            </p>

                            {isFetchingSubcollection && (
                              <div className="flex items-center justify-center gap-2 py-3 text-slate-400 text-[10px] font-bold font-mono">
                                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-500" />
                                Отримання питань з підколекцій...
                              </div>
                            )}

                            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                              {/* 1. Mapped Questions / Вкладені у документ */}
                              {totalMappedQs > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  <div className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200/50 pb-0.5 mb-0.5">
                                    Вкладені у документ Рівня ({totalMappedQs})
                                  </div>
                                  {qGroups.map((group) => (
                                    <div key={group.fieldName} className="flex flex-col gap-1.5">
                                      {group.questions.map((q) => {
                                        const matched = QUESTION_TEMPLATES.find(t => t.id === q.data?.type?.toLowerCase() || t.id === q.data?.type);
                                        const colors = matched ? getQuestionTypeColors(matched.id) : null;
                                        const qParts = q.id.split('--');
                                        const indexNum = qParts[1] || '??';
                                        
                                        return (
                                          <div
                                            key={q.id}
                                            className="bg-white border border-slate-200 hover:border-slate-300 p-2.5 rounded-lg flex items-start justify-between gap-3 transition shadow-3xs"
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-mono font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded leading-none shrink-0" title="Question index Number">
                                                  #{indexNum}
                                                </span>
                                                {matched && colors && (
                                                  <span className={`text-[8px] font-black uppercase px-1 leading-none rounded border tracking-wider scale-[0.95] ${colors.badge}`}>
                                                    {matched.nameUk.split('(')[0].trim()}
                                                  </span>
                                                )}
                                                <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]" title={q.id}>
                                                  {q.id}
                                                </span>
                                              </div>
                                              
                                              <p className="text-[11px] font-bold text-slate-700 leading-snug mt-1.5 truncate">
                                                {q.data?.question || "Джерело / Матеріал..."}
                                              </p>
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setLoadRequest({
                                                  category: activeCol,
                                                  level: parseInt(selectedDoc.id, 10) || 1,
                                                  lang: group.lang || 'ua',
                                                  questionId: q.id,
                                                  questionData: q.data
                                                });
                                                setActiveTab('constructor');
                                              }}
                                              title="Load into Constructor / Редагувати в Конструкторі"
                                              className="p-1 px-2 text-[10px] font-extrabold tracking-wide uppercase bg-amber-500 hover:bg-amber-600 text-slate-950 rounded transition flex items-center gap-1 shadow-3xs active:scale-95 cursor-pointer select-none"
                                            >
                                              <Pencil className="h-2.5 w-2.5 shrink-0" />
                                              Змінити
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 2. Subcollection Questions / Окремі документи в підколекції */}
                              {totalSubcolQs > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  <div className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200/50 pb-0.5 mb-0.5">
                                    Окремі документи в підколекціях ({totalSubcolQs})
                                  </div>
                                  {subcollectionQuestions.map((q) => {
                                    const matched = QUESTION_TEMPLATES.find(t => t.id === q.data?.type?.toLowerCase() || t.id === q.data?.type);
                                    const colors = matched ? getQuestionTypeColors(matched.id) : null;
                                    const qParts = q.id.split('--');
                                    const indexNum = qParts[1] || '??';
                                    
                                    return (
                                      <div
                                        key={q.id}
                                        className="bg-white border border-emerald-200 hover:border-emerald-300 p-2.5 rounded-lg flex items-start justify-between gap-3 transition shadow-3xs"
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded leading-none shrink-0" title="Question index Number">
                                              #{indexNum}
                                            </span>
                                            {matched && colors && (
                                              <span className={`text-[8px] font-black uppercase px-1 leading-none rounded border tracking-wider scale-[0.95] ${colors.badge}`}>
                                                {matched.nameUk.split('(')[0].trim()}
                                              </span>
                                            )}
                                            <span className="text-[9px] text-slate-400 font-mono truncate max-w-[120px]" title={q.id}>
                                              {q.id}
                                            </span>
                                          </div>
                                          
                                          <p className="text-[11px] font-bold text-slate-700 leading-snug mt-1.5 truncate">
                                            {q.data?.question || "Джерело / Матеріал..."}
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setLoadRequest({
                                              category: activeCol,
                                              level: parseInt(selectedDoc.id, 10) || 1,
                                              lang: q.lang || 'ua',
                                              questionId: q.id,
                                              questionData: q.data
                                            });
                                            setActiveTab('constructor');
                                          }}
                                          title="Load into Constructor / Редагувати в Конструкторі"
                                          className="p-1 px-2 text-[10px] font-extrabold tracking-wide uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded transition flex items-center gap-1 shadow-3xs active:scale-95 cursor-pointer select-none"
                                        >
                                          <Pencil className="h-2.5 w-2.5 shrink-0" />
                                          Змінити
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ID Editing Input Row */}
                      <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl flex flex-col gap-1.5 shadow-2xs">
                        <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
                          <span>📝 ID Документа (Document ID / Name)</span>
                          <span className="text-[9px] text-slate-400 font-medium select-none text-right">зміна ID запише новий та видалить старий</span>
                        </label>
                        <input
                          type="text"
                          value={editDocId}
                          onChange={e => setEditDocId(e.target.value)}
                          className="font-mono text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 px-3 py-2 rounded-lg w-full transition"
                          placeholder="Введіть новий ID"
                        />
                      </div>

                      {/* Tabs mode for editing */}
                      <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl mb-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditTabMode('visual')}
                          className={`text-center py-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            editTabMode === 'visual'
                              ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                          }`}
                        >
                          Конструктор Питань (Visual Builder)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditTabMode('raw')}
                          className={`text-center py-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            editTabMode === 'raw'
                              ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                          }`}
                        >
                          Редактор Полів (Raw Fields)
                        </button>
                      </div>

                      {editTabMode === 'visual' ? (
                        <div className="min-h-[220px]">
                          <Suspense fallback={<LazyPanelFallback />}>
                            <QuestionVisualForm fields={editFields} setFields={setEditFields} />
                          </Suspense>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 min-h-[220px]">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                            Document Schema Fields ({editFields.length}) / Поля схеми документа ({editFields.length})
                          </span>
                          
                          {editFields.length === 0 ? (
                            <p className="text-xs font-mono text-slate-400 italic">No fields map inside this row. (Немає полів у цьому рядку.)</p>
                          ) : (
                            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                              {editFields.map((f, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 transition">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-mono font-bold text-slate-800">{f.key}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[9px] font-mono font-semibold text-slate-400 bg-slate-200 px-1 py-0.5 rounded tracking-wider uppercase">
                                        {f.type}
                                      </span>
                                      <button
                                        onClick={() => handleRemoveFieldFromEdit(f.key)}
                                        className="p-0.5 text-slate-400 hover:text-red-600 rounded transition"
                                        title="Remove attribute / Видалити атрибут"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <input
                                    type="text"
                                    value={f.value}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditFields(editFields.map((item, i) => i === idx ? { ...item, value: val } : item));
                                    }}
                                    className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-md focus:ring-1 focus:ring-amber-500 font-mono w-full"
                                  />
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Attribute inline footer */}
                          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Add custom Schema attribute (Додати кастомний атрибут схеми)</span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <input
                                type="text"
                                placeholder="Key Name (Назва ключа)"
                                value={addNewFieldKey}
                                onChange={e => setAddNewFieldKey(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white"
                              />
                              <select
                                value={addNewFieldType}
                                onChange={e => setAddNewFieldType(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg focus:outline-none"
                              >
                                <option value="string">string (рядок)</option>
                                <option value="number">number (число)</option>
                                <option value="boolean">boolean (булеве)</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Value attribute (Значення)"
                                value={addNewFieldVal}
                                onChange={e => setAddNewFieldVal(e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg focus:outline-none focus:bg-white"
                              />
                            </div>
                            <button
                              onClick={handleAddFieldToEdit}
                              className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Plus className="h-3 w-3" /> Append Attribute (Додати атрибут)
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Doc actions bottom bar */}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                        <button
                          onClick={() => handleDeleteDocument(selectedDoc!.id)}
                          className="text-xs text-red-600 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete Document (Видалити документ)
                        </button>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openDocDetails(selectedDoc!)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition cursor-pointer"
                          >
                            Reset (Скинути)
                          </button>
                          <button
                            onClick={handleSaveDocument}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-3.5 rounded-lg transition cursor-pointer"
                          >
                            Save Fields (Зберегти поля)
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="bg-slate-100 border border-dashed border-slate-300 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3 text-slate-400 min-h-[300px]">
                      <FileTextIcon className="h-8 w-8 text-slate-300" />
                      <p className="text-xs font-semibold text-slate-700">No Document Selected (Документ не обрано)</p>
                      <p className="text-[11px] text-slate-500 max-w-xs p-1">
                        Select any row on the document workspace table to inspect parameters and edit custom object fields in real time.
                        <br />
                        <span className="text-slate-400">Оберіть рядок у таблиці документів, щоб переглянути параметри та редагувати поля об'єкта в реальному часі.</span>
                      </p>
                    </div>
                  )}

                  {/* Add document manual dialog component */}
                  {isAddingDoc && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white border border-amber-200 rounded-xl p-5 shadow-lg flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-950 text-sm flex items-center gap-1.5">
                            <Plus className="h-4 w-4 text-amber-500" /> Create Document (Створити документ)
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium">Insert custom collection row in "{activeCol}" (Вставити власний рядок колекції в "{activeCol}")</p>
                        </div>
                        <button onClick={() => setIsAddingDoc(false)} className="p-1 hover:bg-slate-100 rounded text-slate-400 transition">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Document Custom ID (Optional) / Власний ID документа (Опціонально)</label>
                            <input
                              type="text"
                              value={newDocId}
                              onChange={e => setNewDocId(e.target.value)}
                              placeholder="Leave blank to generate random hash (Залиште порожнім для автогенерації)"
                              className="text-xs bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-mono focus:bg-white"
                            />
                          </div>

                          {/* Tabs mode for creating */}
                          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl mb-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCreateTabMode('visual')}
                              className={`text-center py-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                createTabMode === 'visual'
                                  ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                                  : 'text-slate-650 hover:text-slate-900 hover:bg-white/40'
                              }`}
                            >
                              Візуальний Конструктор (Visual Builder)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCreateTabMode('raw')}
                              className={`text-center py-1.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                                createTabMode === 'raw'
                                  ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                                  : 'text-slate-650 hover:text-slate-900 hover:bg-white/40'
                              }`}
                            >
                              Редактор Схеми (Raw Fields)
                            </button>
                          </div>

                          {createTabMode === 'visual' ? (
                            <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                              <Suspense fallback={<LazyPanelFallback />}>
                                <QuestionVisualForm fields={newDocFields} setFields={setNewDocFields} isNew={true} />
                              </Suspense>
                            </div>
                          ) : (
                            <>
                              {/* Fields templates */}
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item data dictionary (Словник даних елемента)</span>
                                <button
                                  type="button"
                                  onClick={handleAddNewFieldName}
                                  className="text-[10px] bg-slate-100 hover:bg-slate-200 font-bold border border-slate-200 rounded px-2 py-0.5 transition flex items-center gap-0.5"
                                >
                                  <Plus className="h-2.5 w-2.5" /> Field (Поле)
                                </button>
                              </div>

                              <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                                {newDocFields.map((f, i) => (
                                  <div key={i} className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <input
                                      type="text"
                                      value={f.key}
                                      onChange={(e) => {
                                        const key = e.target.value;
                                        setNewDocFields(newDocFields.map((item, idx) => idx === i ? { ...item, key } : item));
                                      }}
                                      placeholder="Key (Ключ)"
                                      className="w-1/3 text-xs bg-white border border-slate-200 px-1.5 py-1 rounded focus:bg-white"
                                    />
                                    <select
                                      value={f.type}
                                      onChange={(e) => {
                                        const type = e.target.value;
                                        setNewDocFields(newDocFields.map((item, idx) => idx === i ? { ...item, type } : item));
                                      }}
                                      className="w-1/4 text-xs bg-white border border-slate-200 px-1 py-1 rounded"
                                    >
                                      <option value="string">string (рядок)</option>
                                      <option value="number">number (число)</option>
                                      <option value="boolean">boolean (булеве)</option>
                                    </select>
                                    <input
                                      type="text"
                                      value={f.value}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setNewDocFields(newDocFields.map((item, idx) => idx === i ? { ...item, value: val } : item));
                                      }}
                                      placeholder="Value (Значення)"
                                      className="flex-1 text-xs bg-white border border-slate-200 px-1.5 py-1 focus:bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveNewDocField(i)}
                                      className="p-1 hover:text-red-500 rounded"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          onClick={() => setIsAddingDoc(false)}
                          className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg border border-slate-200 transition"
                        >
                          Cancel (Скасувати)
                        </button>
                        <button
                          onClick={handleCreateDocument}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-1.5 px-4.5 rounded-lg transition"
                        >
                          Create Row (Створити рядок)
                        </button>
                      </div>
                    </motion.div>
                  )}

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DATA IMPORT AND EXPORT FOR FIREBASE */}
          {activeTab === 'import' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col gap-6">
              <div>
                <h3 className="font-bold text-slate-950 text-base flex items-center gap-2">
                  <Upload className="h-5 w-5 text-amber-500" />
                  JSON Upload & Bulk Import (Завантаження JSON та масовий імпорт)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Завантажуйте та імпортуйте резервні копії або окремі Noesis-питання безпосередньо у Firestore вашої активної бази даних.
                </p>
              </div>

              {/* Mode Selector Tabs inside Tab 2 */}
              <div className="flex border-b border-slate-200 pb-2.5 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setImportTabMode('single')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    importTabMode === 'single'
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  🎯 Імпорт конкретного питання (Noesis Import)
                </button>
                <button
                  type="button"
                  onClick={() => setImportTabMode('bulk')}
                  className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                    importTabMode === 'bulk'
                      ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  📁 Масовий імпорт у колекції (Bulk Mode)
                </button>
              </div>

              {importTabMode === 'single' ? (
                // MODE A: SINGLE QUESTION EXPLICIT TARGETED IMPORT
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Targeted Location Details & File Upload */}
                  <div className="flex flex-col gap-4">
                    <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider block border-b border-amber-100 pb-1.5">
                      1. Параметри місця та ідентифікатора (Target Path Options)
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-650">Вибір категорії (Category)</label>
                        <select
                          value={importTarget}
                          onChange={e => {
                            const val = e.target.value;
                            setImportTarget(val);
                            setActiveCol(val);
                            localStorage.setItem('noesis_category', val);
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-slate-700 font-bold"
                        >
                          {collectionsList.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-650">Номер рівня (Level)</label>
                        <input
                          type="number"
                          min={1}
                          value={singleQuestionLevel}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                            setSingleQuestionLevel(val);
                            localStorage.setItem('noesis_level', String(val));
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 font-semibold font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-650">Мова (Language)</label>
                        <select
                          value={singleQuestionLang}
                          onChange={e => {
                            const val = e.target.value;
                            setSingleQuestionLang(val);
                            localStorage.setItem('noesis_lang', val);
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-slate-700 font-mono"
                        >
                          <option value="ua">ua (Українська)</option>
                          <option value="en">en (English)</option>
                          <option value="de">de (Deutsch)</option>
                          <option value="es">es (Español)</option>
                          <option value="fr">fr (Français)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-650">Номер питання (No.)</label>
                        <input
                          type="number"
                          min={1}
                          value={singleQuestionNumber}
                          onChange={e => {
                            const val = e.target.value;
                            updateSingleQuestionNumber(val);
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 font-semibold font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                        <label className="text-xs font-bold text-slate-650">Блок (Block ID)</label>
                        <input
                          type="text"
                          maxLength={5}
                          value={singleQuestionBlock}
                          onChange={e => {
                            const val = e.target.value;
                            setSingleQuestionBlock(val);
                            localStorage.setItem('noesis_block', val);
                          }}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 font-semibold font-mono"
                          placeholder="A, B, C..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-650">Ярлик назви (Slug Part)</label>
                        <input
                          type="text"
                          value={singleQuestionSlug}
                          onChange={e => setSingleQuestionSlug(slugify(e.target.value).substring(0, 15))}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-700 font-mono"
                          placeholder="авто: макс 15 симв."
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-650">Суфікс (Suffix)</label>
                          <button
                            type="button"
                            onClick={() => setSingleQuestionSuffix(Math.random().toString(36).substring(2, 6))}
                            className="text-[9px] text-amber-600 hover:underline font-bold cursor-pointer font-sans"
                          >
                            Випадковий
                          </button>
                        </div>
                        <input
                          type="text"
                          maxLength={8}
                          value={singleQuestionSuffix}
                          onChange={e => setSingleQuestionSuffix(e.target.value.replace(/[^a-z0-9]/g, ''))}
                          className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-705 font-mono text-center font-bold"
                        />
                      </div>
                    </div>

                    {/* Literature status toggle control */}
                    <div className="flex flex-col gap-1.5 p-3 bg-amber-50/40 border border-amber-200/60 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          📚 <span>Джерела приховані на початку (literatureHiddenAtStart)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newVal = !singleQuestionLiteratureHidden;
                            setSingleQuestionLiteratureHidden(newVal);
                            localStorage.setItem('noesis_single_q_lit_hidden', String(newVal));
                            if (singleQuestionJson.trim()) {
                              try {
                                const parsed = JSON.parse(singleQuestionJson.trim());
                                parsed.literatureHiddenAtStart = newVal;
                                if (!Array.isArray(parsed.recommendedLiterature)) {
                                  parsed.recommendedLiterature = [];
                                }
                                setSingleQuestionJson(JSON.stringify(parsed, null, 2));
                              } catch {
                                // keep string if parse error
                              }
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                            singleQuestionLiteratureHidden
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {singleQuestionLiteratureHidden ? 'Так (Приховано)' : 'Ні (Показувати одразу)'}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Автоматично встановлює маркер <code className="font-mono text-amber-800">literatureHiddenAtStart</code> у завантажуваному JSON для приховування джерел до відповіді.
                      </p>
                    </div>

                    {/* Drag-and-drop / selector Zone */}
                    <div className="flex flex-col gap-2 mt-1">
                      <label className="text-xs font-bold text-slate-600">2. Імпорт Noesis JSON файлу (JSON File Upload)</label>
                      <div className="border-2 border-dashed border-slate-200 hover:border-amber-400 bg-slate-50/50 hover:bg-amber-50/5 px-4 py-5 rounded-xl transition duration-150 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer relative group">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              try {
                                const content = event.target?.result as string;
                                const res = robustParseJson(content);
                                if (!res.data) {
                                  triggerToast(`Помилка синтаксису JSON у файлі "${file.name}"${res.line ? ` (рядок ${res.line}, колонка ${res.column})` : ''}: ${res.error}`, 'error');
                                  if (res.cleanedJson) {
                                    setSingleQuestionJson(res.cleanedJson);
                                  } else {
                                    setSingleQuestionJson(content);
                                  }
                                  return;
                                }
                                const parsedObj = res.data;
                                
                                // Auto sync metadata (question number, block, slug, lang) if present in uploaded JSON
                                extractAndSyncSingleQuestionMeta(parsedObj);
                                
                                // Auto sync literatureHiddenAtStart
                                if (typeof parsedObj.literatureHiddenAtStart === 'boolean') {
                                  setSingleQuestionLiteratureHidden(parsedObj.literatureHiddenAtStart);
                                  localStorage.setItem('noesis_single_q_lit_hidden', String(parsedObj.literatureHiddenAtStart));
                                } else if (typeof parsedObj.isLiteratureHiddenAtStart === 'boolean') {
                                  setSingleQuestionLiteratureHidden(parsedObj.isLiteratureHiddenAtStart);
                                  localStorage.setItem('noesis_single_q_lit_hidden', String(parsedObj.isLiteratureHiddenAtStart));
                                  parsedObj.literatureHiddenAtStart = parsedObj.isLiteratureHiddenAtStart;
                                  delete parsedObj.isLiteratureHiddenAtStart;
                                } else {
                                  parsedObj.literatureHiddenAtStart = singleQuestionLiteratureHidden;
                                }

                                if (!Array.isArray(parsedObj.recommendedLiterature)) {
                                  parsedObj.recommendedLiterature = [];
                                }

                                setSingleQuestionJson(JSON.stringify(parsedObj, null, 2));
                                
                                const autoText = parsedObj.question || parsedObj.questionText || parsedObj.text || '';
                                if (autoText && !singleQuestionSlug) {
                                  setSingleQuestionSlug(slugify(autoText).substring(0, 15));
                                }
                                triggerToast(`Файл "${file.name}" зчитано та перевірено успішно!`, 'success');
                              } catch (parseError: any) {
                                triggerToast(`Помилка читання файлу: ${parseError.message}`, 'error');
                              }
                            };
                            reader.readAsText(file);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          id="single-file-upload-input"
                        />
                        <Upload className="h-6 w-6 text-slate-400 group-hover:text-amber-500 transition-colors" />
                        <div className="text-xs font-sans">
                          <span className="font-extrabold text-amber-600 group-hover:text-amber-700">Оберіть файл JSON</span> або перетягніть його сюди
                        </div>
                        <p className="text-[10px] text-slate-400 font-sans">Підтримується завантаження .json файлу одного питання</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Code Editor & Load Sample Buttons */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5 flex-1 select-all h-full min-h-[250px]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <span className="text-xs font-bold text-slate-600">Вміст JSON Питання (Validate / Direct Editor)</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (!singleQuestionJson.trim()) return;
                              const res = robustParseJson(singleQuestionJson.trim());
                              if (!res.data) {
                                triggerToast(`Помилка синтаксису JSON${res.line ? ` (рядок ${res.line}, колонка ${res.column})` : ''}: ${res.error}`, 'error');
                                if (res.cleanedJson) {
                                  // offer cleaned version
                                  setSingleQuestionJson(res.cleanedJson);
                                }
                                return;
                              }
                              const parsed = res.data;
                              parsed.lang = parsed.lang || singleQuestionLang;
                              parsed.topics = Array.isArray(parsed.topics) ? parsed.topics : [];
                              parsed.scientificDisciplines = Array.isArray(parsed.scientificDisciplines) ? parsed.scientificDisciplines : [];
                              parsed.explanation = parsed.explanation || '';
                              parsed.recommendedLiterature = Array.isArray(parsed.recommendedLiterature) ? parsed.recommendedLiterature : [];
                              parsed.literatureHiddenAtStart = typeof parsed.literatureHiddenAtStart === 'boolean' ? parsed.literatureHiddenAtStart : singleQuestionLiteratureHidden;
                              setSingleQuestionJson(JSON.stringify(parsed, null, 2));
                              triggerToast('JSON успішно нормалізовано!', 'success');
                            }}
                            className="text-[9.5px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded px-1.5 py-0.5 font-bold transition cursor-pointer"
                            title="Додати всі обов'язкові поля Noesis (literatureHiddenAtStart, recommendedLiterature, topics тощо)"
                          >
                            ✨ Нормалізувати
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleQuestionJson(JSON.stringify({
                                lang: singleQuestionLang || "ua",
                                type: "SINGLE_CHOICE",
                                question: "Який хімічний елемент є найпоширенішим у Всесвіті?",
                                answers: ["Водень", "Гелій", "Кисень", "Вуглець"],
                                correctAnswerIndices: [0],
                                explanation: "Близько 75% видимої маси Всесвіту складається з водню.",
                                topics: ["хімія", "всесвіт"],
                                scientificDisciplines: ["chemistry"],
                                recommendedLiterature: [
                                  {
                                    name: "Астрофізика для тих, хто поспішає",
                                    link: "https://uk.wikipedia.org/wiki/Водень"
                                  }
                                ],
                                literatureHiddenAtStart: true,
                                points: 10
                              }, null, 2));
                              setSingleQuestionSlug("hydrogen-elem");
                              setSingleQuestionLiteratureHidden(true);
                              localStorage.setItem('noesis_single_q_lit_hidden', 'true');
                            }}
                            className="text-[9.5px] bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 border border-slate-205 rounded px-1.5 py-0.5 font-bold transition cursor-pointer"
                          >
                            + Демо-1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleQuestionJson(JSON.stringify({
                                lang: singleQuestionLang || "ua",
                                type: "TRUE_FALSE",
                                question: "Звук у вакуумі може поширюватися зі швидкістю світла.",
                                correctAnswer: false,
                                explanation: "У вакуумі немає речовини, здатній коливатися, тому звук там поширюватися взагалі не може.",
                                topics: ["фізика", "акустика"],
                                scientificDisciplines: ["physics"],
                                recommendedLiterature: [
                                  {
                                    name: "Основи фізики та акустики",
                                    link: "https://uk.wikipedia.org/wiki/Звук"
                                  }
                                ],
                                literatureHiddenAtStart: false,
                                points: 5
                              }, null, 2));
                              setSingleQuestionSlug("sound-vacuum");
                              setSingleQuestionLiteratureHidden(false);
                              localStorage.setItem('noesis_single_q_lit_hidden', 'false');
                            }}
                            className="text-[9.5px] bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 border border-slate-205 rounded px-1.5 py-0.5 font-bold transition cursor-pointer"
                          >
                            + Демо-2
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleQuestionJson(JSON.stringify({
                                lang: singleQuestionLang || "ua",
                                type: "CAUSAL_GRAPH",
                                question: "Причинно-наслідкове дослідження фотосинтезу та хлоропластів",
                                introduction: "У цьому науковому дослідженні вам потрібно встановити причинно-наслідкові зв'язки між світловою фазою фотосинтезу та виділенням кисню.",
                                scientificDisciplines: ["biology"],
                                topics: ["фотосинтез", "біохімія"],
                                explanation: "Загальне пояснення: підвищення температури активує ферменти фотосинтезу до межі денатурації.",
                                schemaVersion: 1,
                                contentVersion: 1,
                                mode: "CAUSAL_REASONING_TREE",
                                settings: {
                                  choiceCount: 2,
                                  shuffleOptions: true,
                                  feedbackTiming: "IMMEDIATE",
                                  allowBacktracking: true,
                                  allowCycles: false,
                                  showVisitedPath: true,
                                  showFullGraphAfterCompletion: true,
                                  requireSourcesForEvidence: true,
                                  maxDecisionCount: 8
                                },
                                startNodeId: "N1",
                                nodes: [
                                  {
                                    id: "N1",
                                    nodeType: "STANDARD",
                                    title: "Первинна гіпотеза ролі світла",
                                    text: "Як інтенсивність світла впливає на швидкість фотосинтезу у рослин?",
                                    prompt: "Оберіть найбільш науково обґрунтоване припущення:",
                                    sourceRefs: ["SRC_1"],
                                    position: { x: 50, y: 100 },
                                    options: [
                                      {
                                        id: "N1_A",
                                        text: "Підвищення інтенсивності світла збільшує збудження хлорофілу та генерацію АТФ.",
                                        scientificValidity: "SUPPORTED",
                                        localCoherence: "HIGH",
                                        transitionRole: "PRIMARY",
                                        transition: { type: "GO_TO_NODE", targetNodeId: "N2" },
                                        effects: [{ variableId: "lightPhaseActive", operation: "SET", value: true }],
                                        scoreDelta: { reasoning: 10, evidence: 5 },
                                        feedback: "Чудово! Світлова фаза активує фотосистему II."
                                      },
                                      {
                                        id: "N1_B",
                                        text: "Світло впливає виключно на темнову фазу фіксації вуглецю без хлорофілу.",
                                        scientificValidity: "CONTRADICTED",
                                        localCoherence: "LOW",
                                        transitionRole: "MISCONCEPTION",
                                        transition: { type: "GO_TO_NODE", targetNodeId: "N3" },
                                        effects: [],
                                        scoreDelta: { reasoning: -5, evidence: 0 },
                                        feedback: "Помилка! Темнова фаза не вимагає прямого світла, але залежить від продуктів світлової."
                                      }
                                    ]
                                  },
                                  {
                                    id: "N2",
                                    nodeType: "STANDARD",
                                    title: "Вплив температури навколишнього середовища",
                                    text: "Під час активної світлової фази температура зросла від +20°C до +35°C.",
                                    prompt: "Які наслідки для фотосинтетичної продуктивності?",
                                    sourceRefs: ["SRC_2"],
                                    position: { x: 300, y: 100 },
                                    options: [
                                      {
                                        id: "N2_A",
                                        text: "Швидкість ферментативних реакцій темнової фази (Рубіско) зростає до оптимуму.",
                                        scientificValidity: "SUPPORTED",
                                        localCoherence: "HIGH",
                                        transitionRole: "PRIMARY",
                                        transition: { type: "GO_TO_ENDING", endingId: "END_SUCCESS" },
                                        effects: [],
                                        scoreDelta: { reasoning: 15, evidence: 10 },
                                        feedback: "Вірно! Ферменти досягають температурного оптимуму."
                                      }
                                    ]
                                  },
                                  {
                                    id: "N3",
                                    nodeType: "STANDARD",
                                    title: "Аналіз помилкової гіпотези",
                                    text: "Хлорофіл залишається неактивним без достатнього квантового збудження.",
                                    prompt: "Як виправити хід дослідження?",
                                    position: { x: 300, y: 300 },
                                    options: [
                                      {
                                        id: "N3_A",
                                        text: "Повернутися до аналізу квантової теорії фотосинтезу.",
                                        scientificValidity: "NEUTRAL",
                                        localCoherence: "MEDIUM",
                                        transitionRole: "SECONDARY",
                                        transition: { type: "GO_TO_NODE", targetNodeId: "N1" },
                                        effects: [],
                                        scoreDelta: { reasoning: 0, evidence: 0 },
                                        feedback: "Повернення до початкового вузла."
                                      }
                                    ]
                                  }
                                ],
                                endings: [
                                  {
                                    id: "END_SUCCESS",
                                    endingType: "COMPLETE_SUCCESS",
                                    title: "Успішне обґрунтування моделі",
                                    text: "Ви побудували коректний причинно-наслідковий граф взаємодії світла, температури та біохімії фотосинтезу.",
                                    scoreMultiplier: 1.0,
                                    badge: "Експерт з Біохімії"
                                  }
                                ],
                                sources: [
                                  {
                                    id: "SRC_1",
                                    title: "Основи фотобіології та спектроскопії хлоропластів",
                                    authors: ["Іваненко А.Б."],
                                    year: 2023,
                                    reliability: "HIGH",
                                    excerpt: "Фотосистема II використовує енергію фотонів для розщеплення води (фотоліз)."
                                  },
                                  {
                                    id: "SRC_2",
                                    title: "Термодинаміка біохімічних процесів рослин",
                                    authors: ["Петренко В.М."],
                                    year: 2022,
                                    reliability: "MEDIUM",
                                    excerpt: "Фермент Рубіско має температурний оптимум в межах 25-35°C."
                                  }
                                ],
                                recommendedLiterature: [
                                  {
                                    name: "Фотосинтез та біохімія рослин",
                                    link: "https://uk.wikipedia.org/wiki/Фотосинтез"
                                  }
                                ],
                                literatureHiddenAtStart: true,
                                points: 20
                              }, null, 2));
                              setSingleQuestionSlug("causal-photosyn");
                              setSingleQuestionLiteratureHidden(true);
                              localStorage.setItem('noesis_single_q_lit_hidden', 'true');
                            }}
                            className="text-[9.5px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded px-1.5 py-0.5 font-bold transition cursor-pointer"
                          >
                            + CAUSAL_GRAPH
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSingleQuestionJson(JSON.stringify({
                                lang: singleQuestionLang || "ua",
                                type: "PAIRWISE_DISTINCTION",
                                objects: [
                                  {
                                    id: "alligator",
                                    name: "Алігатор",
                                    imagePath: "/quiz-images/erudite/level-0001/q012/alligator.webp",
                                    altText: "Голова алігатора з широкою мордою"
                                  },
                                  {
                                    id: "crocodile",
                                    name: "Крокодил",
                                    imagePath: "/quiz-images/erudite/level-0001/q012/crocodile.webp",
                                    altText: "Голова крокодила з вузькою мордою"
                                  }
                                ],
                                statements: [
                                  {
                                    id: "snout_u",
                                    text: "Має широку U-подібну морду",
                                    correctObjectId: "alligator"
                                  },
                                  {
                                    id: "snout_v",
                                    text: "Має вужчу V-подібну морду",
                                    correctObjectId: "crocodile"
                                  }
                                ],
                                explanation: "Алігатори відрізняються ширшою U-подібною мордою, тоді як у крокодилів вона V-подібна.",
                                topics: ["зоологія", "плазуни"],
                                scientificDisciplines: ["biology"],
                                recommendedLiterature: [
                                  {
                                    name: "Енциклопедія плазунів",
                                    link: "https://uk.wikipedia.org/wiki/Крокодили"
                                  }
                                ],
                                literatureHiddenAtStart: true
                              }, null, 2));
                              setSingleQuestionSlug("alligator-croc");
                              setSingleQuestionLiteratureHidden(true);
                              localStorage.setItem('noesis_single_q_lit_hidden', 'true');
                            }}
                            className="text-[9.5px] bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-900 border border-slate-205 rounded px-1.5 py-0.5 font-bold transition cursor-pointer"
                          >
                            + Демо-3
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={singleQuestionJson}
                        onChange={e => setSingleQuestionJson(e.target.value)}
                        placeholder='{ "type": "single_choice", "question": "Ваш текст...", "options": ["Варіант 1", "Варіант 2"] }'
                        rows={Math.min(40, Math.max(10, (singleQuestionJson.match(/\n/g) || []).length + 1))}
                        className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full min-h-[180px] max-h-[720px] text-slate-800 transition-all duration-150 overflow-y-auto"
                      />

                      {singleQuestionJson.trim() ? (() => {
                        const check = robustParseJson(singleQuestionJson);
                        if (check.data) {
                          return (
                            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-800 font-medium">
                              <span className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>Синтаксис JSON валідний {check.autoFixed ? '(авто-виправлено друкарські лапки/коми)' : ''}</span>
                              </span>
                              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded font-bold">
                                Type: {String((check.data as any).type || 'VALID')}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div className="flex flex-col gap-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 font-medium">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5 text-rose-700 font-bold">
                                ⚠️ Помилка синтаксису JSON {check.line ? `(Рядок ${check.line}, Колонка ${check.column})` : ''}
                              </span>
                              {check.cleanedJson && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (check.cleanedJson) {
                                      setSingleQuestionJson(check.cleanedJson);
                                      triggerToast('Автоматично виправлено друкарські символи!', 'success');
                                    }
                                  }}
                                  className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-bold px-2 py-0.5 rounded transition cursor-pointer"
                                >
                                  ⚡ Виправити авто
                                </button>
                              )}
                            </div>
                            <p className="font-mono text-[10.5px] text-rose-700 bg-rose-100/70 p-1.5 rounded break-all leading-tight select-all">
                              {check.error}
                            </p>
                          </div>
                        );
                      })() : null}
                    </div>

                    {/* Separate Tournament JSON Editor Section */}
                    <div className="flex flex-col gap-3 p-3.5 bg-amber-50/40 border border-amber-200/70 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-extrabold text-slate-800">
                            Записати також у Турніри (tournamentQuestionPools)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newVal = !saveSingleToTournament;
                            setSaveSingleToTournament(newVal);
                            localStorage.setItem('noesis_save_single_to_tournament', String(newVal));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                            saveSingleToTournament
                              ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {saveSingleToTournament ? 'Увімкнено' : 'Вимкнено'}
                        </button>
                      </div>

                      <p className="text-[10.5px] text-slate-500 leading-normal">
                        Якщо увімкнено, турнірна версія пройде серверну перевірку й буде опублікована в <code className="font-mono text-amber-800 font-bold">tournamentQuestionPools</code>.
                      </p>

                      {saveSingleToTournament && (
                        <div className="flex flex-col gap-3 pt-2 border-t border-amber-200/50">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-600 uppercase">Категорія (categoryId)</label>
                              <select
                                value={tournamentCategoryId}
                                onChange={e => {
                                  setTournamentCategoryId(e.target.value);
                                  localStorage.setItem('noesis_tournament_category_id', e.target.value);
                                }}
                                className="text-xs bg-white border border-slate-200 p-2 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                <option value="science">science</option>
                                <option value="culture">culture</option>
                                <option value="erudite">erudite</option>
                                <option value="philosophy">philosophy</option>
                                <option value="noesis">noesis</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-600 uppercase">Складність (Difficulty 1-5)</label>
                              <select
                                value={tournamentDifficulty}
                                onChange={e => {
                                  const val = Number(e.target.value);
                                  setTournamentDifficulty(val);
                                  localStorage.setItem('noesis_tournament_difficulty', String(val));
                                }}
                                className="text-xs bg-white border border-slate-200 p-2 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              >
                                <option value={1}>1 - Легко</option>
                                <option value={2}>2 - Нормально</option>
                                <option value={3}>3 - Середньо</option>
                                <option value={4}>4 - Складно</option>
                                <option value={5}>5 - Експерт</option>
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-600 uppercase">Сезон/Рік (seasonId)</label>
                              <input
                                type="text"
                                value={tournamentSeasonId}
                                onChange={e => {
                                  setTournamentSeasonId(e.target.value);
                                  localStorage.setItem('noesis_tournament_season_id', e.target.value);
                                }}
                                placeholder="2026 (опціонально)"
                                className="text-xs bg-white border border-slate-200 p-2 rounded-lg font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-1">
                            <label className="text-xs font-bold text-slate-600">Вміст Турнірного JSON (Tournament Question JSON)</label>
                            <button
                              type="button"
                              onClick={() => {
                                if (!singleQuestionJson.trim()) {
                                  triggerToast('Спочатку введіть або завантажте основний JSON питання', 'error');
                                  return;
                                }
                                const res = robustParseJson(singleQuestionJson.trim());
                                if (!res.data) {
                                  triggerToast('Синтаксична помилка в основному JSON', 'error');
                                  return;
                                }
                                const tournObj = buildTournamentPayloadFromMain(res.data);
                                setSingleTournamentJson(JSON.stringify(tournObj, null, 2));
                                setSaveSingleToTournament(true);
                                localStorage.setItem('noesis_save_single_to_tournament', 'true');
                                triggerToast('Турнірний JSON згенеровано з основного!', 'success');
                              }}
                              className="text-[9.5px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded px-2 py-0.5 font-bold transition cursor-pointer self-start sm:self-auto"
                            >
                              ⚡ Згенерувати з основного JSON
                            </button>
                          </div>

                          <textarea
                            value={singleTournamentJson}
                            onChange={e => setSingleTournamentJson(e.target.value)}
                            placeholder='{ "type": "SINGLE_CHOICE", "question": "Текст турнірного питання...", "answers": ["А", "Б", "В", "Г"], "correctAnswerIndices": [0] }'
                            rows={Math.min(24, Math.max(6, (singleTournamentJson.match(/\n/g) || []).length + 1))}
                            className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full min-h-[120px] max-h-[480px] text-slate-800 transition-all duration-150 overflow-y-auto"
                          />

                          {singleTournamentJson.trim() ? (() => {
                            const check = robustParseJson(singleTournamentJson);
                            if (check.data) {
                              return (
                                <div className="flex flex-col gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[10.5px] text-emerald-800 font-medium">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="flex items-center gap-1.5">
                                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                      <span>Турнірний JSON валідний {check.autoFixed ? '(авто-виправлено)' : ''}</span>
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleSingleTournamentOnlyImport}
                                    disabled={singleTournamentImporting}
                                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-[11px] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                  >
                                    {singleTournamentImporting ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Збереження у tournamentQuestionPools...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-emerald-200" /> 🏆 Записати ТІЛЬКИ цей Турнірний JSON в БД (tournamentQuestionPools)
                                      </>
                                    )}
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div className="flex flex-col gap-1 p-2 bg-rose-50 border border-rose-200 rounded-lg text-[10.5px] text-rose-800 font-medium">
                                <span className="font-bold text-rose-700">⚠️ Помилка Турнірного JSON: {check.error}</span>
                              </div>
                            );
                          })() : null}
                        </div>
                      )}
                    </div>

                    {/* Display Live Path Preview */}
                    <div className="bg-amber-50/55 p-3 rounded-lg border border-amber-200/65 flex flex-col gap-1 text-[11px] text-slate-600 leading-normal font-sans">
                      <span className="font-extrabold text-amber-900 uppercase tracking-wide text-[9px]">Live Firestore Target / Шлях імпорту:</span>
                      <code className="font-mono text-slate-700 break-all select-all">
                        /{singleQuestionLang === 'ua' ? importTarget : `${importTarget}_${singleQuestionLang}`}/{singleQuestionLevel}/questions/{getSingleQuestionId(singleQuestionNumber, singleQuestionBlock, singleQuestionSlug, '', singleQuestionSuffix, singleQuestionLang)}
                      </code>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleSingleQuestionImport}
                        disabled={singleQuestionImporting || singleTournamentImporting}
                        className={`py-3.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer font-sans ${
                          singleQuestionImporting
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold'
                        }`}
                      >
                        {singleQuestionImporting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" /> Записуємо в базу...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 text-slate-950 shrink-0" />
                            <span>Завантажити питання ({saveSingleToTournament ? 'Основне + Турнір' : 'Основне'})</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleSingleTournamentOnlyImport}
                        disabled={singleQuestionImporting || singleTournamentImporting}
                        className={`py-3.5 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer font-sans ${
                          singleTournamentImporting
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold'
                        }`}
                      >
                        {singleTournamentImporting ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" /> Записуємо в Турніри...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
                            <span>Записати ТІЛЬКИ в БД Турнірів (tournamentQuestionPools)</span>
                          </>
                        )}
                      </button>
                    </div>

                    {singleImportResult && (
                      <div
                        className={`rounded-xl border p-3 text-xs leading-relaxed ${
                          singleImportResult.tournamentError
                            ? 'border-rose-200 bg-rose-50 text-rose-900'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        }`}
                      >
                        {singleImportResult.mainQuestionId && (
                          <div>
                            <strong>Основне питання:</strong>{' '}
                            <code className="break-all">
                              {singleQuestionLang === 'ua' ? importTarget : `${importTarget}_${singleQuestionLang}`}/
                              {singleQuestionLevel}/questions/{singleImportResult.mainQuestionId}
                            </code>
                          </div>
                        )}
                        {singleImportResult.tournamentQuestionId && (
                          <div className="mt-1">
                            <strong>Турнірне питання:</strong>{' '}
                            <code className="break-all">
                              tournamentQuestionPools/{singleImportResult.tournamentQuestionId}
                            </code>
                          </div>
                        )}
                        {singleImportResult.tournamentError && (
                          <div className="mt-1">
                            <strong>Турнірна копія не записана:</strong>{' '}
                            {singleImportResult.tournamentError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // MODE B: PRE-EXISTING BULK UPLOAD FLOW
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Configuration Input panel */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600">1. Target Collection Path in active connection (Цільовий шлях колекції в активному підключенні)</label>
                      <select
                        value={importTarget}
                        onChange={e => setImportTarget(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-slate-700"
                      >
                        {collectionsList.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">
                        * Choose from monitored paths or add new path under "Monitored Paths" sidebar menu first.
                        <br />
                        * Оберіть із відстежуваних шляхів або спершу додайте новий шлях у бічному меню відстеження.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 select-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <label className="text-xs font-bold text-slate-600">2. Document JSON Array (Масив JSON документів)</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setImportJson(`[
    {
      "id": "user_demo_1",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "score": 95,
      "joined": "2026-06-01"
    },
    {
      "id": "user_demo_2",
      "name": "Alex Mercer",
      "email": "alex@example.com",
      "score": 105,
      "joined": "2026-06-01"
    }
  ]`);
                            }}
                            className="text-[10px] underline font-bold text-slate-500 hover:text-amber-600 cursor-pointer"
                            title="Load User Layout Template"
                          >
                            User Temp. (Шаблон користувача)
                          </button>
                          <span className="text-slate-300 text-[10px]">|</span>
                          <button
                            onClick={() => {
                              setImportJson(`[
    {
      "id": "quiz_q_1",
      "question": "Яка столиця України?",
      "options": ["Київ", "Львів", "Одеса", "Харків"],
      "correct_answer": "Київ",
      "points": 10,
      "category": "Географія"
    },
    {
      "id": "quiz_q_2",
      "question": "Яка планета є найбільшою в Сонячній системі?",
      "options": ["Земля", "Марс", "Юпітер", "Венера"],
      "correct_answer": "Юпітер",
      "points": 10,
      "category": "Астрономія"
    },
    {
      "id": "quiz_q_3",
      "question": "Який тег використовується для створення гіперпосилань в HTML?",
      "options": ["<a>", "<img>", "<p>", "<h1>"],
      "correct_answer": "<a>",
      "points": 5,
      "category": "Програмування"
    }
  ]`);
                            }}
                            className="text-[10px] underline font-bold text-slate-500 hover:text-amber-600 cursor-pointer"
                            title="Load Quiz Question Layout Template"
                          >
                            Quiz Temp. (Шаблон питань)
                          </button>
                          <span className="text-slate-300 text-[10px]">|</span>
                          <button
                            onClick={() => {
                              setImportTarget('tournamentQuestionPools');
                              setImportJson(`[
  {
    "id": "tourn_demo_1",
    "language": "ua",
    "categoryId": "science",
    "type": "SINGLE_CHOICE",
    "question": "Яка найближча зоря до Сонячної системи?",
    "difficulty": 2,
    "status": "active",
    "answers": ["Проксима Центавра", "Альфа Центавра A", "Сіріус", "Вега"],
    "correctAnswerIndices": [0],
    "explanation": "Проксима Центавра — червоний карлик на відстані 4.24 світлових років.",
    "topicLabel": "Астрономія",
    "sourceVersion": 1,
    "poolKey": "ua|science|SINGLE_CHOICE|2"
  },
  {
    "id": "tourn_demo_2",
    "language": "ua",
    "categoryId": "science",
    "type": "TRUE_FALSE",
    "question": "Вода складається з водню та кисню.",
    "difficulty": 1,
    "status": "active",
    "correctAnswer": true,
    "explanation": "Формула води — H2O.",
    "topicLabel": "Хімія",
    "sourceVersion": 1,
    "poolKey": "ua|science|TRUE_FALSE|1"
  }
]`);
                            }}
                            className="text-[10px] underline font-bold text-amber-600 hover:text-amber-700 cursor-pointer"
                            title="Load Tournament Question Pool Template"
                          >
                            Tournament Temp. (Шаблон турнірних питань)
                          </button>
                        </div>
                      </div>
                      
                      <textarea
                        value={importJson}
                        onChange={e => setImportJson(e.target.value)}
                        placeholder='[ { "id": "custom-id-name", "field": "value" }, ... ]'
                        rows={10}
                        className="text-xs bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        onClick={() => handleBulkImport()}
                        disabled={importing}
                        className={`py-3 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer ${
                          importing
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
                        }`}
                      >
                        {importing ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" /> Batch uploading...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 shrink-0" />
                            <span>Масовий імпорт в "{importTarget}"</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleBulkImport('tournamentQuestionPools')}
                        disabled={importing}
                        className={`py-3 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.99] cursor-pointer ${
                          importing
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold'
                        }`}
                      >
                        <Sparkles className="h-4 w-4 text-amber-300 shrink-0" />
                        <span>Записати масив у Турніри (tournamentQuestionPools)</span>
                      </button>
                    </div>
                  </div>

                  {/* Import trace logs output console */}
                  <div className="bg-slate-950 rounded-xl p-5 border border-slate-800 text-slate-200 flex flex-col font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <span className="text-amber-500 font-bold text-[11px] uppercase tracking-wider">Job Log Console (Консоль журналу завдань)</span>
                      <button
                        onClick={() => setImportLog([])}
                        className="text-[9px] hover:underline bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        Clear Logs (Очистити журнал)
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[350px] flex flex-col gap-1.5 pr-1">
                      {importLog.length === 0 ? (
                        <p className="text-slate-500 italic text-[11px]">System awaiting connection job load details... (Система очікує підключення та завантаження деталей...)</p>
                      ) : (
                        importLog.map((log, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded font-mono text-[11px] leading-normal ${
                              log.type === 'error'
                                ? 'bg-red-950/40 text-red-400 border-l border-red-500'
                                : 'bg-emerald-950/40 text-emerald-400 border-l border-emerald-500'
                            }`}
                          >
                            &gt; {log.message}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROJECT MANAGEMENT AND CUSTOM CREDENTIALS */}
          {activeTab === 'credentials' && (
            <div className="flex1 flex flex-col gap-6">

              {/* Active list config profiles */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-xs flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-950 text-base">Workspace Firebase Database Connections</h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Switch project connections instantly and debug individual environments. (Миттєво створюйте підключення та перемикайтеся між середовищами.)
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNewConn(!showNewConn)}
                    className="bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-900 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-auto shadow-xs"
                  >
                    <Link className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Import Custom Firebase Project (Імпортувати власний проект)</span>
                    <span className="sm:hidden">Імпортувати проект Firebase</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connections.map((conn) => (
                    <div
                      key={conn.id}
                      onClick={() => {
                        setActiveConnId(conn.id);
                        triggerToast(`Switched active profile: ${conn.name}`);
                      }}
                      className={`relative border p-4.5 rounded-xl flex flex-col justify-between gap-3 text-left transition cursor-pointer select-none ${
                        activeConnId === conn.id
                          ? 'border-amber-500 bg-amber-50/20 ring-1 ring-amber-500'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      {activeConnId === conn.id && (
                        <span className="absolute top-3 right-3 text-[10px] bg-amber-500 text-slate-950 font-semibold px-2 py-0.5 rounded-md shadow-sm">
                          ACTIVE (АКТИВНЕ)
                        </span>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">
                          {conn.isLocal ? 'Sandbox config (Конфігурація пісочниці)' : 'Custom config (Власна конфігурація)'}
                        </span>
                        <h4 className="font-bold text-slate-950 text-xs truncate max-w-[180px]">{conn.name}</h4>
                        <div className="font-mono text-[10px] text-slate-500 mt-2 space-y-1">
                          <p className="truncate"><strong>Project ID (ID проекту):</strong> {conn.config.projectId}</p>
                          <p className="truncate"><strong>DB ID (ID бази):</strong> {conn.config.firestoreDatabaseId || '(default)'}</p>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-3 mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-mono text-[9px]">
                          Added (Додано): {new Date(conn.createdAt).toLocaleDateString()}
                        </span>
                        
                        {!conn.isLocal && (
                          <button
                            onClick={(e) => handleRemoveConnection(conn.id, e)}
                            className="text-red-600 hover:underline font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" /> Disconnect (Відключити)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form custom additions */}
              {showNewConn && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border border-slate-200 rounded-xl p-6 shadow-md flex flex-col gap-4"
                >
                  <div>
                    <h3 className="font-bold text-slate-950 text-sm">Import Custom Firebase Project Connection (Імпорт підключення власного проекту Firebase)</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Paste Web Client Credentials from your own external Firebase config (Вставте веб-ключі доступу клієнта з власної зовнішньої конфігурації Firebase)</p>
                  </div>

                  {connError && (
                    <div className="bg-red-50 text-red-800 border-l-4 border-red-500 p-3 rounded text-xs select-all">
                      {connError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600">Connection Nickname (Назва підключення)</label>
                      <input
                        type="text"
                        placeholder="e.g. My Prod Database (напр., Моя робоча база)"
                        value={newConnName}
                        onChange={e => setNewConnName(e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-lg focus:outline-none focus:bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-600">Firebase Config JSON Object (Об'єкт JSON конфігурації Firebase)</label>
                        <button
                          onClick={() => {
                            setNewConnConfig(`{
  "apiKey": "${activeConn.config.apiKey}",
  "authDomain": "${activeConn.config.authDomain}",
  "projectId": "other-custom-project-id",
  "appId": "1:000000000000:web:0000000000",
  "firestoreDatabaseId": "(default)"
}`);
                          }}
                          className="text-[10px] underline hover:text-amber-600 cursor-pointer"
                        >
                          Load example skeleton (Завантажити шаблон-приклад)
                        </button>
                      </div>
                      <textarea
                        rows={6}
                        placeholder='{ "apiKey": "...", "projectId": "...", "appId": "..." }'
                        value={newConnConfig}
                        onChange={e => setNewConnConfig(e.target.value)}
                        className="text-xs bg-slate-50 p-2.5 border border-slate-300 rounded-lg font-mono focus:bg-white focus:outline-none w-full"
                      />
                      <span className="text-[10px] text-slate-400">
                        * Grab this JSON block directly inside 'Project Settings' under your Google Firebase Console dashboard.
                        <br />
                        * Скопіюйте цей блок JSON безпосередньо в розділі 'Налаштування проекту' (Project Settings) у вашій консолі Google Firebase.
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => setShowNewConn(false)}
                      className="bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold py-2 px-4 rounded-lg border border-slate-200 transition"
                    >
                      Cancel (Скасувати)
                    </button>
                    <button
                      onClick={handleAddConnection}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs py-2 px-4.5 rounded-lg transition"
                    >
                      Connect & Save Profile (Підключити та зберегти профіль)
                    </button>
                  </div>
                </motion.div>
              )}

            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// Minimal placeholder icons to circumvent unused imports or missing native elements and keep setup isolated
function FileCircleIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M10 8h4" />
      <path d="M12 8v8" />
    </svg>
  );
}

function FileTextIcon(props: any) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}
