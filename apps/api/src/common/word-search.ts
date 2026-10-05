// ============================================================
// Search that understands several words: "aadhya bose" finds Aadhya Bose
// even though no single field contains both words. Every word must match
// at least one of the fields (in any order), so "bose aadhya" and
// "aadhya engineering" work too.
// ============================================================

/** Up to 5 words, trimmed; empty when there's nothing to search for. */
export function searchWords(search: string | undefined | null): string[] {
  return (search ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5);
}

/**
 * `{ AND: [ { OR: fieldsFor(word1) }, { OR: fieldsFor(word2) }, … ] }`,
 * or `undefined` when the search is empty.
 */
export function wordsWhere<T>(search: string | undefined | null, fieldsFor: (word: string) => T[]): { AND: Array<{ OR: T[] }> } | undefined {
  const words = searchWords(search);
  return words.length ? { AND: words.map((w) => ({ OR: fieldsFor(w) })) } : undefined;
}
