export type ContentMinimumAge = 16 | 18;

export type ContentWarning =
  | 'VIOLENCE'
  | 'WAR'
  | 'CRIME'
  | 'SELF_HARM'
  | 'SEXUAL_CONTENT'
  | 'SUBSTANCES'
  | 'EXTREMISM'
  | 'DISTURBING_MEDICAL';

export type ContentTag =
  | 'sports'
  | 'biology'
  | 'history'
  | 'politics'
  | 'religion'
  | 'medicine'
  | 'war'
  | 'crime';

export interface ContentPolicyFields {
  minimumAge: ContentMinimumAge;
  contentWarnings: ContentWarning[];
  contentTags: ContentTag[];
}

export const DEFAULT_CONTENT_POLICY: ContentPolicyFields = {
  minimumAge: 16,
  contentWarnings: [],
  contentTags: [],
};

export const CONTENT_WARNING_OPTIONS: ReadonlyArray<{ value: ContentWarning; label: string }> = [
  { value: 'VIOLENCE', label: 'Насильство' },
  { value: 'WAR', label: 'Війна' },
  { value: 'CRIME', label: 'Злочини' },
  { value: 'SELF_HARM', label: 'Самопошкодження' },
  { value: 'SEXUAL_CONTENT', label: 'Сексуальний контент' },
  { value: 'SUBSTANCES', label: 'Алкоголь або наркотики' },
  { value: 'EXTREMISM', label: 'Екстремізм' },
  { value: 'DISTURBING_MEDICAL', label: 'Чутливі медичні матеріали' },
];

export const CONTENT_TAG_OPTIONS: ReadonlyArray<{ value: ContentTag; label: string }> = [
  { value: 'sports', label: 'Спорт' },
  { value: 'biology', label: 'Біологія' },
  { value: 'history', label: 'Історія' },
  { value: 'politics', label: 'Політика' },
  { value: 'religion', label: 'Релігія' },
  { value: 'medicine', label: 'Медицина' },
  { value: 'war', label: 'Війна' },
  { value: 'crime', label: 'Злочини' },
];

const warningValues = new Set<string>(CONTENT_WARNING_OPTIONS.map(option => option.value));
const tagValues = new Set<string>(CONTENT_TAG_OPTIONS.map(option => option.value));

export function normalizeContentPolicy(value: Partial<ContentPolicyFields> | null | undefined): ContentPolicyFields {
  const minimumAge: ContentMinimumAge = Number(value?.minimumAge) >= 18 ? 18 : 16;
  const contentWarnings = Array.from(new Set(
    (Array.isArray(value?.contentWarnings) ? value.contentWarnings : [])
      .map(item => String(item).trim().toUpperCase())
      .filter((item): item is ContentWarning => warningValues.has(item)),
  ));
  const contentTags = Array.from(new Set(
    (Array.isArray(value?.contentTags) ? value.contentTags : [])
      .map(item => String(item).trim().toLowerCase())
      .filter((item): item is ContentTag => tagValues.has(item)),
  ));

  return { minimumAge, contentWarnings, contentTags };
}
