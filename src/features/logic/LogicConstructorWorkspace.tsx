import { useState } from 'react';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { Binary } from 'lucide-react';
import { LogicalInferenceConstructor } from '../../components/LogicalInferenceConstructor';

type LogicQuestionKind = 'logical_inference';

interface LogicConstructorWorkspaceProps {
  dbInstance: Firestore | null;
  authInstance: Auth | null;
  category: string;
  levelId: string;
  questionId: string;
  lang: string;
  questionNumber: string;
  block: string;
  hasConstructorPermission: boolean;
  triggerToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshExplorer: () => void;
}

const logicQuestionTypes = [
  {
    id: 'logical_inference' as const,
    label: 'Логічний висновок',
    type: 'LOGICAL_INFERENCE',
    icon: Binary,
  },
];

export function LogicConstructorWorkspace(props: LogicConstructorWorkspaceProps) {
  const [activeType, setActiveType] = useState<LogicQuestionKind>('logical_inference');

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {logicQuestionTypes.map(item => {
          const Icon = item.icon;
          const active = item.id === activeType;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveType(item.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition ${active ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              <span className="hidden font-mono text-[9px] opacity-65 sm:inline">{item.type}</span>
            </button>
          );
        })}
        <span className="px-2 text-[11px] text-slate-500">Наступні логічні типи додаватимуться в цьому робочому просторі.</span>
      </div>

      {activeType === 'logical_inference' && <LogicalInferenceConstructor {...props} />}
    </div>
  );
}
