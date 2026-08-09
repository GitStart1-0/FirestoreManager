import { LoaderCircle } from 'lucide-react';

export function LazyPanelFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500" role="status">
      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>Завантаження редактора…</span>
    </div>
  );
}
