import { SUBCATEGORIES } from '@/lib/catalog';
import type { MeasureUnit } from '@/lib/units';

/**
 * Looks up a product by barcode in the open databases
 * Open Food Facts / Open Beauty Facts / Open Products Facts (free, no key).
 * Limit: 100 product reads / minute / user — plenty for scanning.
 * Text search (10 req/min) is deliberately NOT used for autocomplete.
 */

type ProductLookup = {
  name: string;
  /** Number of items in the pack ("6 x 33 cl" → 6), null if not a multipack */
  quantity: number | null;
  /** Size of one item ("33 cl" → 330 mL) */
  size: number | null;
  size_unit: MeasureUnit | null;
  category: string;
  subcategory: string | null;
  barcode: string;
};

const SOURCES = [
  { host: 'world.openfoodfacts.org', category: 'Alimentaire' },
  { host: 'world.openbeautyfacts.org', category: 'Hygiène' },
  { host: 'world.openproductsfacts.org', category: 'Autre' },
];

const FIELDS = 'product_name_fr,product_name,brands,quantity,categories_tags';

type OffProduct = {
  product_name_fr?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
};

/** Whole lookup (all sources) gives up after this: a slow network must not leave the scan hanging. */
const LOOKUP_DEADLINE_MS = 10_000;

/** Fetches and parses the JSON, aborted after `ms` (body included). */
async function fetchJson(url: string, ms: number): Promise<{ ok: boolean; json?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'InventaireMaison/1.0 (Android)' },
    });
    if (!res.ok) return { ok: false };
    return { ok: true, json: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

/** Measure units as written on packs, longest first ("litre" before "l"), mapped to ours. */
// prettier-ignore
const UNIT_ALIASES: [RegExp, (value: number) => [number, MeasureUnit]][] = [
  [/^(kg|kgs|kilos?|kilogrammes?|kilograms?)$/, (v) => [v, 'kg']],
  [/^(mg|milligrammes?)$/, (v) => [v / 1000, 'g']],
  [/^(g|gr|grs|grammes?|grams?)$/, (v) => [v, 'g']],
  [/^(cl|centilitres?)$/, (v) => [v * 10, 'ml']],
  [/^(dl|décilitres?|decilitres?)$/, (v) => [v * 100, 'ml']],
  [/^(ml|millilitres?|milliliters?)$/, (v) => [v, 'ml']],
  [/^(l|lt|litres?|liters?)$/, (v) => [v, 'l']],
];
const UNIT_PATTERN =
  'kilogrammes?|kilograms?|kilos?|kgs|kg|milligrammes?|mg|grammes?|grams?|grs|gr|g|centilitres?|cl|' +
  'd[ée]cilitres?|dl|millilitres?|milliliters?|ml|litres?|liters?|lt|l';
const MEASURE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})(?![a-zà-ÿ])`);
/** " x 6" right after the measure, but not " x 2 kg" (another measure). */
const PACK_AFTER = new RegExp(`^\\s*[x×]\\s*(\\d+)(?![\\d.]|\\s*(?:${UNIT_PATTERN})(?![a-zà-ÿ]))`);

/**
 * "500 g", "250 gr" -> size 500 g; "1,5 L", "1 litre" -> 1.5 L; "75 cl" -> 750 mL;
 * "6 x 33 cl", "33cl x 6" -> 6 items of 330 mL; "4 x 125 g" -> 4 items of 125 g.
 */
function parseOffQuantity(
  text: string | undefined,
): { quantity: number | null; size: number | null; size_unit: MeasureUnit | null } | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, '.');

  // Pack count before the measure ("6 x 33 cl"): the measure is read after it
  const before = t.match(/(\d+)\s*[x×]\s*(?=\d)/);
  const rest = before ? t.slice(before.index! + before[0].length) : t;
  const m = rest.match(MEASURE);
  // ... or after it ("33cl x 6"), when not followed by another measure
  const after = m && !before ? rest.slice(m.index! + m[0].length).match(PACK_AFTER) : null;
  const count = before ? Number(before[1]) : after ? Number(after[1]) : null;
  if (!m) return count ? { quantity: count, size: null, size_unit: null } : null;

  const toUnit = UNIT_ALIASES.find(([re]) => re.test(m[2]))?.[1];
  if (!toUnit) return count ? { quantity: count, size: null, size_unit: null } : null;
  const [size, size_unit] = toUnit(Number(m[1]));
  return { quantity: count, size, size_unit };
}

function guessCategory(tags: string[] | undefined, fallback: string) {
  if (!tags?.length) return fallback;
  if (tags.some((t) => t.includes('frozen'))) return 'Surgelés';
  if (tags.some((t) => t.includes('beverages') || t.includes('boissons'))) return 'Boissons';
  return fallback;
}

/**
 * Subcategory guessed from Open Food Facts tags (e.g. "en:meats").
 * Only returns values present in SUBCATEGORIES[category].
 */
// prettier-ignore
const SUBCATEGORY_TAGS: { category: string; subcategory: string; keywords: string[] }[] = [
  { category: 'Boissons', subcategory: 'Eau', keywords: ['waters'] },
  { category: 'Boissons', subcategory: 'Alcool', keywords: ['alcoholic-beverages', 'wines', 'beers', 'spirits'] },
  { category: 'Boissons', subcategory: 'Café & thé', keywords: ['coffees', 'teas'] },
  { category: 'Boissons', subcategory: 'Lait', keywords: ['milks', 'plant-milks'] },
  { category: 'Boissons', subcategory: 'Jus & sodas', keywords: ['juices', 'sodas', 'syrups'] },
  { category: '*', subcategory: 'Poisson', keywords: ['fishes', 'seafood'] },
  { category: '*', subcategory: 'Viande', keywords: ['meats', 'poultries', 'hams', 'sausages'] },
  { category: '*', subcategory: 'Légumes', keywords: ['vegetables', 'potatoes'] },
  { category: 'Alimentaire', subcategory: 'Fruits', keywords: ['fruits'] },
  { category: 'Alimentaire', subcategory: 'Crèmerie', keywords: ['dairies', 'cheeses', 'yogurts', 'eggs', 'butters'] },
  { category: 'Alimentaire', subcategory: 'Conserves', keywords: ['canned-foods'] },
  { category: 'Alimentaire', subcategory: 'Petit-déjeuner', keywords: ['breakfasts', 'coffees', 'teas', 'spreads'] },
  { category: 'Alimentaire', subcategory: 'Snacks & desserts', keywords: ['snacks', 'biscuits', 'chocolates', 'desserts'] },
  { category: 'Alimentaire', subcategory: 'Boulangerie', keywords: ['breads'] },
  { category: 'Alimentaire', subcategory: 'Condiments & épices', keywords: ['condiments', 'sauces', 'spices', 'oils', 'vinegars'] },
  { category: 'Alimentaire', subcategory: 'Épicerie sèche', keywords: ['pastas', 'rices', 'cereals-and-potatoes', 'flours', 'legumes', 'sugars'] },
  { category: 'Surgelés', subcategory: 'Plats préparés', keywords: ['meals', 'pizzas'] },
  { category: 'Surgelés', subcategory: 'Desserts', keywords: ['ice-creams', 'desserts'] },
];

function guessSubcategory(tags: string[] | undefined, category: string): string | null {
  if (!tags?.length) return null;
  for (const rule of SUBCATEGORY_TAGS) {
    if (rule.category !== '*' && rule.category !== category) continue;
    if (!SUBCATEGORIES[category]?.includes(rule.subcategory)) continue;
    if (tags.some((t) => rule.keywords.some((k) => t.endsWith(`:${k}`) || t.includes(`-${k}`)))) {
      return rule.subcategory;
    }
  }
  return null;
}

/**
 * Returns the product found, null if unknown,
 * or throws if the network is unavailable.
 */
export async function lookupBarcode(barcode: string): Promise<ProductLookup | null> {
  const deadline = Date.now() + LOOKUP_DEADLINE_MS;
  let networkErrors = 0;
  for (const source of SOURCES) {
    const remaining = deadline - Date.now();
    // Out of time: the sources not tried count as unreachable
    if (remaining <= 0) {
      networkErrors += 1;
      continue;
    }
    try {
      const res = await fetchJson(
        `https://${source.host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
        remaining,
      );
      if (!res.ok) continue;
      const json = res.json as { status?: number; product?: OffProduct };
      const p = json?.product;
      const baseName = p?.product_name_fr?.trim() || p?.product_name?.trim();
      if (json?.status !== 1 || !p || !baseName) continue;

      const brand = p.brands?.split(',')[0]?.trim();
      const name = brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${baseName} (${brand})` : baseName;
      const qty = parseOffQuantity(p.quantity);
      const category = guessCategory(p.categories_tags, source.category);
      return {
        name,
        quantity: qty?.quantity ?? null,
        size: qty?.size ?? null,
        size_unit: qty?.size_unit ?? null,
        category,
        subcategory: guessSubcategory(p.categories_tags, category),
        barcode,
      };
    } catch {
      networkErrors += 1;
    }
  }
  if (networkErrors === SOURCES.length) throw new Error('offline');
  return null;
}
