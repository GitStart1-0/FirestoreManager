import React, { useState } from 'react';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Package, UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';
import { publishLevelBundle } from '../services/levelBundlePublisher';
import { LevelBundlePublishResult } from '../types/levelBundle';

interface LevelPublishPanelProps {
  db: Firestore | null;
  auth: Auth | null;
  category: string;
  resolvedCategory: string;
  levelId: string;
  lang: string;
  disabled?: boolean;
  onPublishingChange?: (isPublishing: boolean) => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LevelPublishPanel: React.FC<LevelPublishPanelProps> = ({
  db,
  auth,
  category,
  resolvedCategory,
  levelId,
  lang,
  disabled = false,
  onPublishingChange,
  triggerToast
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastResult, setLastResult] = useState<LevelBundlePublishResult | null>(null);

  const handlePublish = async () => {
    if (!db || !auth) {
      triggerToast('Firebase DB або Auth не ініціалізовано.', 'error');
      return;
    }

    try {
      setIsPublishing(true);
      if (onPublishingChange) onPublishingChange(true);

      const result = await publishLevelBundle({
        db,
        auth,
        category,
        resolvedCategory,
        levelId,
        lang
      });

      setLastResult(result);
      triggerToast(
        `Пакет рівня ${levelId} (версія v${result.version}) успішно опубліковано! (${result.questionCount} питань, ${(result.byteSize / 1024).toFixed(1)} KB)`,
        'success'
      );
    } catch (err: any) {
      triggerToast(err.message || 'Помилка під час публікації пакета рівня.', 'error');
    } finally {
      setIsPublishing(false);
      if (onPublishingChange) onPublishingChange(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-indigo-600" />
          <h3 className="font-extrabold text-slate-900 text-sm">Публікація бандлу рівня (Bundle Publisher)</h3>
        </div>
        <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200/60 font-bold">
          {resolvedCategory} / Level {levelId} [{lang.toUpperCase()}]
        </span>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        Експортує та опубліковує всі підтверджені питання даного рівня у бандл форматі (JSON v1) до Firebase Storage.
      </p>

      {lastResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-col gap-1 text-xs text-emerald-900">
          <div className="flex items-center gap-1.5 font-bold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Останній опублікований бандл: v{lastResult.version}</span>
          </div>
          <p className="font-mono text-[11px] text-emerald-800 break-all">
            Path: {lastResult.storagePath}
          </p>
          <p className="text-[11px] text-emerald-700">
            Питань: {lastResult.questionCount} | Розмір: {(lastResult.byteSize / 1024).toFixed(1)} KB | SHA-256: {lastResult.sha256.slice(0, 16)}...
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePublish}
        disabled={disabled || isPublishing}
        className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer ${
          disabled || isPublishing
            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.99]'
        }`}
      >
        <UploadCloud className="h-4 w-4" />
        <span>{isPublishing ? 'Публікація бандлу...' : 'Опублікувати пакет рівня (Publish Level Bundle)'}</span>
      </button>
    </div>
  );
};
