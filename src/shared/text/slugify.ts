const UKRAINIAN_TRANSLITERATION: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ye', ж: 'zh',
  з: 'z', и: 'y', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
  ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'yu', я: 'ya'
};

export function slugify(value: string): string {
  const transliterated = Array.from(value).map(character => {
    const lower = character.toLowerCase();
    return UKRAINIAN_TRANSLITERATION[lower] ?? character;
  }).join('');

  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9-_\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function normalizeApostrophes(value: string): string {
  return value ? value.replace(/['’`ʻ´‘]/g, "'") : '';
}
