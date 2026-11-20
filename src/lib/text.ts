// prettier-ignore
const ACCENTS: Record<string, string> = {
  à: 'a', â: 'a', ä: 'a', á: 'a', ã: 'a', å: 'a',
  ç: 'c',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  î: 'i', ï: 'i', í: 'i', ì: 'i',
  ô: 'o', ö: 'o', ó: 'o', ò: 'o', õ: 'o',
  ù: 'u', û: 'u', ü: 'u', ú: 'u',
  ÿ: 'y', ñ: 'n', œ: 'oe', æ: 'ae',
};

/** Lowercase without accents, for comparing / searching ("Pâtes" -> "pates"). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àâäáãåçéèêëîïíìôöóòõùûüúÿñœæ]/g, (c) => ACCENTS[c] ?? c)
    .trim();
}

/** Uppercase first letter. */
export function capitalize(text: string): string {
  const t = text.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** What separates words, in the text AND in the query: "demi-écrémé", "huile d'olive", "Alimentaire › Viande". */
const WORD_SEPARATORS = /[\s'’,.()/›-]+/;

/**
 * Does the query match the text (both already normalized)?
 * Each typed word must be the START of a word in the text: "poul" finds "Poulet"
 * but not "Ampoules"; "lait dem" and "demi-ecr" find "Lait demi-écrémé".
 */
export function matchesWordStart(normalizedText: string, normalizedQuery: string): boolean {
  const queryWords = normalizedQuery.split(WORD_SEPARATORS).filter(Boolean);
  // Punctuation only ("-"): no word to look for, nothing matches
  if (queryWords.length === 0) return false;
  const words = normalizedText.split(WORD_SEPARATORS);
  return queryWords.every((q) => words.some((w) => w.startsWith(q)));
}

/**
 * Ranks autocomplete candidates (word start only): exact name first, then names
 * starting with the query, then names where another word matches; others are dropped.
 * Ignores case, accents and duplicates (the first one wins). `exact: false` drops the exact match.
 */
export function rankByQuery<T>(
  query: string,
  candidates: Iterable<T>,
  nameOf: (candidate: T) => string,
  { limit = 6, exact = true }: { limit?: number; exact?: boolean } = {},
): T[] {
  const q = normalize(query);
  if (!q) return [];
  const seen = new Set<string>();
  const exactMatches: T[] = [];
  const starts: T[] = [];
  const others: T[] = [];
  for (const candidate of candidates) {
    const n = normalize(nameOf(candidate));
    if (seen.has(n)) continue;
    if (n === q) {
      if (exact) exactMatches.push(candidate);
    } else if (n.startsWith(q)) starts.push(candidate);
    else if (matchesWordStart(n, q)) others.push(candidate);
    else continue;
    seen.add(n);
  }
  return [...exactMatches, ...starts, ...others].slice(0, limit);
}

/** Names for autocomplete (see rankByQuery), without the exact match (already typed). */
export function filterByQuery(query: string, names: string[], limit = 6): string[] {
  return rankByQuery(query, names, (name) => name, { limit, exact: false });
}

/** "1 objet", "3 objets", "0 objet". */
export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n > 1 ? pluralWord : word}`;
}

/** "1 objet sera supprimé" / "3 objets seront supprimés" (deletion confirmations) */
export function willBeDeleted(n: number, word: string): string {
  return `${plural(n, word)} ${n > 1 ? 'seront supprimés' : 'sera supprimé'}`;
}

/** "Cuisine › Frigo" */
export function formatLocation(item: { room_name: string; furniture_name: string }): string {
  return `${item.room_name} › ${item.furniture_name}`;
}

/** Does the item match the (already normalized) query? Name, category, subcategory, notes; word start only. */
export function matchesItem(
  item: { name: string; category: string | null; subcategory: string | null; notes: string | null },
  normalizedQuery: string,
): boolean {
  return matchesWordStart(
    normalize(`${item.name} ${item.category ?? ''} ${item.subcategory ?? ''} ${item.notes ?? ''}`),
    normalizedQuery,
  );
}
