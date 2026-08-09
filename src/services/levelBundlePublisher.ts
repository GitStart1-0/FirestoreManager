import { Auth } from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes } from 'firebase/storage';
import {
  LevelBundleManifest,
  LevelBundlePublishResult,
  LevelQuestionBundle
} from '../types/levelBundle';
import {
  isContentCategory,
  normalizeContentLanguage,
  resolvedCategoryName
} from '../domain/content/catalog';

const BUNDLE_SCHEMA_VERSION = 1;
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;
const SAFE_LEVEL_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface PublishLevelBundleInput {
  db: Firestore;
  auth: Auth;
  category: string;
  resolvedCategory: string;
  levelId: string;
  lang: string;
}

export async function publishLevelBundle({
  db,
  auth,
  category,
  resolvedCategory,
  levelId,
  lang
}: PublishLevelBundleInput): Promise<LevelBundlePublishResult> {
  if (!auth.currentUser) {
    throw new Error('Увійдіть у дозволений обліковий запис конструктора перед публікацією.');
  }

  const normalizedLang = normalizeContentLanguage(lang);
  validateBundleIdentity(category, levelId, normalizedLang);
  const expectedResolvedCategory = resolvedCategoryName(category, normalizedLang);
  if (resolvedCategory !== expectedResolvedCategory && resolvedCategory !== `${category}_${lang}`) {
    throw new Error(
      `Невідповідна колекція джерела: ${resolvedCategory}. Очікується ${expectedResolvedCategory}.`
    );
  }

  const sourceLevelRef = doc(db, expectedResolvedCategory, levelId);
  const questionSnapshot = await getDocs(collection(sourceLevelRef, 'questions'));
  const questions = questionSnapshot.docs
    .filter(question => matchesLanguage(question.id, question.data().lang, normalizedLang))
    .sort(compareQuestionDocuments)
    .map(question => ({
      id: question.id,
      data: toJsonRecord(question.data())
    }));

  if (questions.length === 0) {
    throw new Error(`У рівні ${expectedResolvedCategory}/${levelId} немає питань мовою ${normalizedLang}.`);
  }

  const targetLevelRef = doc(db, category, levelId);
  const targetLevelSnapshot = await getDoc(targetLevelRef);
  const previousManifest = targetLevelSnapshot.data()?.publishedBundles?.[normalizedLang] as
    | Partial<LevelBundleManifest>
    | undefined;
  const version = Math.max(0, Number(previousManifest?.version) || 0) + 1;
  const bundle: LevelQuestionBundle = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    contentVersion: version,
    category,
    resolvedCategory: expectedResolvedCategory,
    levelId,
    lang: normalizedLang,
    publishedAt: new Date().toISOString(),
    questions
  };
  const json = JSON.stringify(bundle);
  const bytes = new TextEncoder().encode(json);

  if (bytes.byteLength > MAX_BUNDLE_BYTES) {
    throw new Error(
      `Пакет має ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MiB. Максимум — 8 MiB; розділіть рівень.`
    );
  }

  const checksum = await sha256(bytes);
  const storagePath = `level-bundles/${category}/${levelId}/${normalizedLang}/v${version}-${checksum.slice(0, 12)}.json`;
  const storage = getStorage(auth.app);
  await uploadBytes(ref(storage, storagePath), bytes, {
    contentType: 'application/json',
    cacheControl: 'public,max-age=31536000,immutable',
    customMetadata: {
      schemaVersion: String(BUNDLE_SCHEMA_VERSION),
      contentVersion: String(version),
      category,
      levelId,
      lang: normalizedLang,
      sha256: checksum
    }
  });

  const manifest: LevelBundleManifest = {
    version,
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    storagePath,
    sha256: checksum,
    questionCount: questions.length,
    byteSize: bytes.byteLength,
    lang: normalizedLang
  };
  await setDoc(
    targetLevelRef,
    {
      levelNumber: Number(levelId) || levelId,
      publishedBundles: {
        [normalizedLang]: {
          ...manifest,
          publishedAt: serverTimestamp()
        }
      }
    },
    { merge: true }
  );

  return { ...manifest, resolvedCategory: expectedResolvedCategory };
}

function validateBundleIdentity(
  category: string,
  levelId: string,
  lang: string
): asserts category is Parameters<typeof resolvedCategoryName>[0] {
  if (!isContentCategory(category)) {
    throw new Error(`Пакетна публікація не підтримує категорію "${category}".`);
  }
  if (!SAFE_LEVEL_ID.test(levelId)) {
    throw new Error('ID рівня має містити 1–64 латинські літери, цифри, дефіс або підкреслення.');
  }
}

function matchesLanguage(id: string, rawLang: unknown, lang: string): boolean {
  const explicitLang = normalizeLanguageIfSupported(rawLang);
  const idLang = id.includes('--') ? normalizeLanguageIfSupported(id.split('--')[0]) : '';
  if (explicitLang) return explicitLang === lang;
  if (idLang) return idLang === lang;
  return true;
}

function normalizeLanguageIfSupported(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z]{2,3}$/i.test(value.trim())) return '';
  try {
    return normalizeContentLanguage(value);
  } catch {
    return '';
  }
}

function compareQuestionDocuments(
  left: { id: string; data(): Record<string, unknown> },
  right: { id: string; data(): Record<string, unknown> }
): number {
  const leftNumber = questionNumber(left.id, left.data());
  const rightNumber = questionNumber(right.id, right.data());
  return leftNumber - rightNumber || left.id.localeCompare(right.id);
}

function questionNumber(id: string, data: Record<string, unknown>): number {
  const rawNumber = data.number ?? data.questionNumber;
  const direct = Number(rawNumber);
  if (Number.isFinite(direct)) return direct;
  const idNumber = id.split(/--|-/).find(part => /^\d+$/.test(part));
  return idNumber ? Number(idNumber) : Number.MAX_SAFE_INTEGER;
}

function toJsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return toJsonValue(value) as Record<string, unknown>;
}

function toJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonValue).filter(item => item !== undefined);
  if (typeof value === 'object') {
    const timestampLike = value as { toDate?: () => Date };
    if (typeof timestampLike.toDate === 'function') return timestampLike.toDate().toISOString();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, item]) => [key, toJsonValue(item)] as const)
        .filter(([, item]) => item !== undefined)
    );
  }
  return undefined;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
