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

/**
 * Does the query match the text (both already normalized)?
 * Each typed word must be the START of a word in the text: "poul" finds "Poulet"
 * but not "Ampoules"; "lait dem" finds "Lait demi-écrémé".
 */
export function matchesWordStart(normalizedText: string, normalizedQuery: string): boolean {
  const words = normalizedText.split(/[\s'’,.()/›-]+/);
  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q)));
}

/**
 * Filters a list of names for autocomplete (word start only):
 * names starting with the query first, then names where another word matches.
 * Ignores case, accents and duplicates; excludes the exact match.
 */
export function filterByQuery(query: string, names: string[], limit = 6): string[] {
  const q = normalize(query);
  if (!q) return [];
  const seen = new Set<string>();
  const starts: string[] = [];
  const others: string[] = [];
  for (const name of names) {
    const n = normalize(name);
    if (seen.has(n) || n === q) continue;
    seen.add(n);
    if (n.startsWith(q)) starts.push(name);
    else if (matchesWordStart(n, q)) others.push(name);
  }
  return [...starts, ...others].slice(0, limit);
}

/** "1 objet", "3 objets", "0 objet". */
export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n > 1 ? pluralWord : word}`;
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
