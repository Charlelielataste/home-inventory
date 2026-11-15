import type { UnitKey } from './units';
import { SUBCATEGORIES } from './catalog';

/**
 * Looks up a product by barcode in the open databases
 * Open Food Facts / Open Beauty Facts / Open Products Facts (free, no key).
 * Limit: 100 product reads / minute / user — plenty for scanning.
 * Text search (10 req/min) is deliberately NOT used for autocomplete.
 */

export type ProductLookup = {
  name: string;
  quantity: number | null;
  unit: UnitKey | null;
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

async function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'InventaireMaison/1.0 (Android)' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** "500 g" -> {500, g}; "1,5 L" -> {1.5, l}; "75 cl" -> {750, ml}; "6 x 33 cl" -> {6, pcs} */
export function parseOffQuantity(text: string | undefined): { quantity: number; unit: UnitKey } | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(',', '.');

  const pack = t.match(/(\d+)\s*[x×]\s*\d/);
  if (pack) return { quantity: Number(pack[1]), unit: 'pcs' };

  const m = t.match(/(\d+(?:\.\d+)?)\s*(kg|mg|g|cl|dl|ml|l)\b/);
  if (!m) return null;
  const value = Number(m[1]);
  switch (m[2]) {
    case 'kg':
      return { quantity: value, unit: 'kg' };
    case 'mg':
      return { quantity: value / 1000, unit: 'g' };
    case 'g':
      return { quantity: value, unit: 'g' };
    case 'l':
      return { quantity: value, unit: 'l' };
    case 'dl':
      return { quantity: value * 100, unit: 'ml' };
    case 'cl':
      return { quantity: value * 10, unit: 'ml' };
    default:
      return { quantity: value, unit: 'ml' };
  }
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
  let networkErrors = 0;
  for (const source of SOURCES) {
    try {
      const res = await fetchWithTimeout(
        `https://${source.host}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`,
        8000,
      );
      if (!res.ok) continue;
      const json = (await res.json()) as { status?: number; product?: OffProduct };
      const p = json.product;
      const baseName = p?.product_name_fr?.trim() || p?.product_name?.trim();
      if (json.status !== 1 || !p || !baseName) continue;

      const brand = p.brands?.split(',')[0]?.trim();
      const name =
        brand && !baseName.toLowerCase().includes(brand.toLowerCase()) ? `${baseName} (${brand})` : baseName;
      const qty = parseOffQuantity(p.quantity);
      const category = guessCategory(p.categories_tags, source.category);
      return {
        name,
        quantity: qty?.quantity ?? null,
        unit: qty?.unit ?? null,
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
