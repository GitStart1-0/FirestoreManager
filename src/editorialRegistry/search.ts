import {normalizeSearchText} from './normalize';
import {RegistrySearchResult, RegistrySnapshot, RegistryUsage} from './types';

function searchableText(usage: RegistryUsage): string {
  return normalizeSearchText([
    usage.conceptId,
    usage.claimKey,
    usage.title,
    usage.question,
    usage.explanation,
    ...usage.terms,
    ...usage.disciplines,
  ].filter(Boolean).join(' '));
}

export function searchRegistry(
  snapshot: RegistrySnapshot,
  query: string,
  options: {sources?: string[]; limit?: number} = {},
): RegistrySearchResult[] {
  const tokens = normalizeSearchText(query).split(' ').filter(token => token.length > 1);
  if (tokens.length === 0) return [];
  const allowed = new Set(options.sources?.map(source => source.toUpperCase()) ?? []);

  return snapshot.usages
    .filter(usage => allowed.size === 0 || allowed.has(usage.source))
    .map(usage => {
      const haystack = searchableText(usage);
      const matchedTerms = tokens.filter(token => haystack.includes(token));
      const exactTerm = usage.terms.some(term => normalizeSearchText(term) === normalizeSearchText(query));
      const conceptMatch = normalizeSearchText(usage.conceptId).includes(normalizeSearchText(query));
      return {
        ...usage,
        matchedTerms,
        score: matchedTerms.length * 10 + (exactTerm ? 15 : 0) + (conceptMatch ? 20 : 0),
      };
    })
    .filter(result => result.matchedTerms.length > 0)
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId))
    .slice(0, Math.min(Math.max(options.limit ?? 20, 1), 100));
}
