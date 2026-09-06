import React from 'react';

export interface LevelCardData {
  style: string;
  title: string;
  topic: string;
  description: string;
  details: string;
}

export function parseLevelCard(raw: unknown): LevelCardData {
  const data = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown> : {};
  const text = (key: string) => typeof data[key] === 'string' ? data[key] as string : '';
  return {
    style: text('style') || 'STANDARD', title: text('title'), topic: text('topic'),
    description: text('description'), details: text('details')
  };
}

export function LevelCardFields({ value, onChange, disabled, onSave }: {
  value: LevelCardData;
  onChange: (value: LevelCardData) => void;
  disabled: boolean;
  onSave: () => void;
}) {
  return <fieldset disabled={disabled} className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col gap-3 disabled:opacity-50">
    <legend className="px-1 text-xs font-bold text-slate-700">Картка рівня · Ерудит</legend>
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      Оформлення
      <select value={value.style} onChange={event => onChange({ ...value, style: event.target.value })} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
        <option value="STANDARD">Звичайний рівень</option>
        <option value="THEMATIC">Тематичний випуск</option>
        {!['STANDARD', 'THEMATIC'].includes(value.style) && <option value={value.style}>Інше оформлення ({value.style})</option>}
      </select>
    </label>
    <p className="text-xs text-slate-500">Позначку «Тематичний випуск» застосунок додає автоматично своєю мовою. Тексти картки задавайте мовою контенту вибраного рівня.</p>
    {value.style === 'THEMATIC' && <>
      {(['title', 'topic', 'description', 'details'] as const).map(field => <label key={field} className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
        {{ title: 'Назва випуску', topic: 'Тема', description: 'Короткий опис', details: 'Деталі (наприклад, 50 питань · 5 блоків)' }[field]}
        <textarea rows={field === 'description' ? 3 : 1} value={value[field]} onChange={event => onChange({ ...value, [field]: event.target.value })} className="rounded-lg border border-slate-200 bg-white p-2 text-sm" />
      </label>)}
    </>}
    <button type="button" onClick={onSave} className="self-start rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">Зберегти оформлення рівня</button>
  </fieldset>;
}
