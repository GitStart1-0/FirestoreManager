export const CONTENT_CATEGORIES = [
  'erudite',
  'science',
  'philosophy',
  'culture',
  'noesis'
] as const;

export type ContentCategory = typeof CONTENT_CATEGORIES[number];

export const CONTENT_LANGUAGES = ['ua', 'en', 'de'] as const;

export type ContentLanguage = typeof CONTENT_LANGUAGES[number];

export function normalizeContentLanguage(language: string): ContentLanguage {
  const normalized = language.trim().toLowerCase();
  if (normalized === 'uk' || normalized === '') return 'ua';
  if (CONTENT_LANGUAGES.includes(normalized as ContentLanguage)) {
    return normalized as ContentLanguage;
  }
  throw new Error(`Непідтримувана мова контенту: ${language}`);
}

export function isContentCategory(value: string): value is ContentCategory {
  return CONTENT_CATEGORIES.includes(value as ContentCategory);
}

export function resolvedCategoryName(category: ContentCategory, language: ContentLanguage): string {
  return language === 'ua' ? category : `${category}_${language}`;
}

export function questionCollectionPath(
  category: ContentCategory,
  levelId: string,
  language: ContentLanguage
): string {
  return `${resolvedCategoryName(category, language)}/${levelId}/questions`;
}
