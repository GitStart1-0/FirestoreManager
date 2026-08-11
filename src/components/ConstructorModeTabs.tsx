import { Binary, GitFork, Layers, Sparkles } from 'lucide-react';

export type ConstructorMode = 'quiz' | 'debate' | 'causal_graph' | 'logic';

interface ConstructorModeTabsProps {
  value: ConstructorMode;
  onChange: (mode: ConstructorMode) => void;
}

const modes = [
  { id: 'quiz' as const, label: 'Тести', extended: 'Quiz', icon: Layers },
  { id: 'debate' as const, label: 'Дебати', extended: 'Debates', icon: Sparkles },
  { id: 'causal_graph' as const, label: 'Причинний граф', extended: 'Causal Graph', icon: GitFork },
  { id: 'logic' as const, label: 'Логіка', extended: 'Logic', icon: Binary },
];

export function ConstructorModeTabs({ value, onChange }: ConstructorModeTabsProps) {
  return (
    <div className="constructor-mode-switch grid w-full max-w-5xl grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 shadow-sm sm:grid-cols-4 sm:gap-2 sm:p-1.5">
      {modes.map(mode => {
        const Icon = mode.icon;
        const active = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            id={`btn-${mode.id.replace('_', '-')}-mode`}
            onClick={() => onChange(mode.id)}
            className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition sm:px-3 ${active ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{mode.label}</span>
            <span className="hidden 2xl:inline">({mode.extended})</span>
          </button>
        );
      })}
    </div>
  );
}
