import React from 'react';
import { AlertTriangle, ShieldCheck, Tags } from 'lucide-react';
import {
  CONTENT_TAG_OPTIONS,
  CONTENT_WARNING_OPTIONS,
  ContentPolicyFields as ContentPolicyValue,
  ContentTag,
  ContentWarning,
} from '../types/contentPolicy';

interface ContentPolicyFieldsProps {
  value: ContentPolicyValue;
  onChange: (value: ContentPolicyValue) => void;
  compact?: boolean;
}

const toggleValue = <T extends string>(items: T[], value: T): T[] =>
  items.includes(value) ? items.filter(item => item !== value) : [...items, value];

export function ContentPolicyFields({ value, onChange, compact = false }: ContentPolicyFieldsProps) {
  const chipClass = (selected: boolean, warning = false) => [
    'rounded-lg border px-3 py-2 text-[11px] font-semibold transition',
    selected
      ? warning
        ? 'border-amber-400 bg-amber-50 text-amber-900'
        : 'border-slate-700 bg-slate-800 text-white'
      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
  ].join(' ');

  return (
    <section className={`rounded-xl border border-slate-200 bg-slate-50/70 ${compact ? 'p-3' : 'p-4 sm:p-5'}`}>
      <div className="mb-4 flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Вікові й тематичні обмеження</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Позначайте зміст, а не складність питання. Контент 18+ завжди приховується до підтвердження віку.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Мінімальний вік (minimumAge)
          </div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
            {([16, 18] as const).map(age => (
              <button
                key={age}
                type="button"
                onClick={() => onChange({ ...value, minimumAge: age })}
                className={chipClass(value.minimumAge === age)}
              >
                {age}+
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Попередження (contentWarnings)
          </div>
          <div className="flex flex-wrap gap-2">
            {CONTENT_WARNING_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({
                  ...value,
                  contentWarnings: toggleValue<ContentWarning>(value.contentWarnings, option.value),
                })}
                className={chipClass(value.contentWarnings.includes(option.value), true)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-700">
            <Tags className="h-3.5 w-3.5" /> Теми для фільтра користувача (contentTags)
          </div>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TAG_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({
                  ...value,
                  contentTags: toggleValue<ContentTag>(value.contentTags, option.value),
                })}
                className={chipClass(value.contentTags.includes(option.value))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
