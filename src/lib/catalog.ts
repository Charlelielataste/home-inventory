import type { IconName } from '@/ui/icon';

import { matchesWordStart, normalize } from './text';
import type { UnitKey } from './units';

// ---------- Categories ----------

export const CATEGORIES = [
  'Alimentaire',
  'Boissons',
  'Surgelés',
  'Hygiène',
  'Entretien',
  'Pharmacie',
  'Bricolage',
  'Linge',
  'Cuisine',
  'Électronique',
  'Papeterie',
  'Loisirs',
  'Autre',
] as const;

/**
 * Subcategories offered for each category (optional).
 * A missing or empty category = no subcategory offered.
 */
export const SUBCATEGORIES: Record<string, string[]> = {
  Alimentaire: [
    'Viande', 'Poisson', 'Fruits', 'Légumes', 'Crèmerie', 'Épicerie sèche', 'Conserves',
    'Condiments & épices', 'Petit-déjeuner', 'Snacks & desserts', 'Boulangerie', 'Traiteur',
  ],
  Boissons: ['Eau', 'Jus & sodas', 'Lait', 'Café & thé', 'Alcool'],
  Surgelés: ['Viande', 'Poisson', 'Légumes', 'Plats préparés', 'Desserts', 'Glaçons'],
  Hygiène: ['Corps', 'Cheveux', 'Dents', 'Visage', 'Rasage', 'Hygiène féminine', 'Papier & coton', 'Bébé'],
  Entretien: ['Vaisselle', 'Lessive', 'Ménage', 'Poubelles', 'Papier & emballages'],
  Pharmacie: ['Médicaments', 'Soins', 'Vitamines', 'Matériel médical'],
  Bricolage: ['Outils', 'Quincaillerie', 'Électricité', 'Piles', 'Colles & adhésifs', 'Peinture', 'Jardin'],
  Linge: ['Linge de lit', 'Linge de bain', 'Linge de maison', 'Vêtements', 'Chaussures'],
  Cuisine: ['Vaisselle', 'Cuisson', 'Ustensiles', 'Rangement', 'Électroménager'],
  Électronique: ['Câbles & chargeurs', 'Audio & vidéo', 'Stockage', 'Informatique', 'Téléphonie'],
  Papeterie: ['Écriture', 'Papier', 'Courrier', 'Fournitures', 'Impression'],
  Loisirs: ['Jeux', 'Livres', 'Sport', 'Loisirs créatifs', 'Musique'],
  Autre: ['Animaux', 'Maison', 'Décoration', 'Divers'],
};

/** Freezer-like furniture ("Congélateur", "Congel cave"…): putting an item there marks it as frozen. */
export function isFreezer(furnitureName: string): boolean {
  return normalize(furnitureName).includes('congel');
}

/** "Alimentaire › Viande", "Alimentaire" or null. */
export function formatCategory(category: string | null, subcategory: string | null): string | null {
  if (!category) return null;
  return subcategory ? `${category} › ${subcategory}` : category;
}

// ---------- Room / furniture suggestions ----------

export const ROOM_SUGGESTIONS = [
  'Cuisine', 'Salon', 'Séjour', 'Salle à manger', 'Chambre', 'Chambre parentale', "Chambre d'amis",
  'Chambre enfant', 'Salle de bain', "Salle d'eau", 'WC', 'Entrée', 'Couloir', 'Bureau', 'Dressing',
  'Cellier', 'Buanderie', 'Débarras', 'Garage', 'Cave', 'Grenier', 'Atelier', 'Véranda',
  'Balcon', 'Terrasse', 'Jardin', 'Abri de jardin',
];

export const DEFAULT_ROOMS = ['Cuisine', 'Salon', 'Chambre', 'Salle de bain', 'Entrée', 'Cellier'];

export const FURNITURE_SUGGESTIONS = [
  'Frigo', 'Réfrigérateur', 'Congélateur', 'Cave à vin', 'Placard', 'Placard haut', 'Placard bas',
  'Garde-manger', 'Meuble sous évier', 'Tiroir', 'Tiroir à couverts', 'Range-épices', 'Vaisselier',
  'Buffet', 'Desserte', 'Armoire', 'Penderie', 'Dressing', 'Commode', 'Table de chevet', 'Sous le lit',
  'Étagère', 'Étagère murale', 'Bibliothèque', 'Meuble TV', 'Bureau', 'Caisson', 'Meuble à chaussures',
  'Meuble vasque', 'Armoire à pharmacie', 'Panier à linge', 'Coffre', 'Coffre à jouets', 'Malle',
  'Boîte de rangement', 'Carton', 'Bac', 'Boîte à outils', 'Établi', 'Armoire de garage', 'Rayonnage',
];

function pickIcon(name: string, rules: [RegExp, IconName][], fallback: IconName): IconName {
  const n = normalize(name);
  return rules.find(([re]) => re.test(n))?.[1] ?? fallback;
}

export function roomIcon(name: string): IconName {
  return pickIcon(
    name,
    [
      [/cuisine/, 'kitchen'],
      [/salle a manger/, 'dining'],
      [/salon|sejour|living/, 'couch'],
      [/enfant|bebe|jeux/, 'teddy-bear'],
      [/chambre/, 'bed'],
      [/wc|toilette/, 'toilet'],
      [/bain|sdb|douche|salle d.eau/, 'bathtub'],
      [/garage|parking/, 'car'],
      [/cave/, 'wine'],
      [/cellier|garde.manger/, 'canned-food'],
      [/bureau/, 'desk'],
      [/entree|couloir|hall/, 'door'],
      [/buanderie|lingerie/, 'laundry'],
      [/dressing/, 'coat'],
      [/atelier|abri/, 'toolbox'],
      [/jardin/, 'seedling'],
      [/balcon|terrasse|veranda|exterieur/, 'plant'],
      [/grenier|combles|debarras/, 'box'],
    ],
    'home',
  );
}

export function furnitureIcon(name: string): IconName {
  return pickIcon(
    name,
    [
      [/congel/, 'ice'],
      [/frigo|refrigerateur|frigidaire/, 'snowflake'],
      [/cave a vin|vin/, 'bottle'],
      [/pharmacie|medic/, 'pill'],
      [/chaussure/, 'shoe'],
      [/armoire de garage|outil|etabli/, 'toolbox'],
      [/armoire|penderie|dressing/, 'coat'],
      [/epice/, 'salt'],
      [/garde.manger|placard|vaisselier|buffet|desserte/, 'canned-food'],
      [/evier/, 'sponge'],
      [/couvert/, 'spoon'],
      [/vasque|salle de bain/, 'mirror'],
      [/linge/, 'basket'],
      [/jouet/, 'teddy-bear'],
      [/meuble tv|tele/, 'tv'],
      [/commode|tiroir|chevet|caisson|bureau/, 'file-cabinet'],
      [/etagere|biblio|rayonnage/, 'books'],
      [/panier/, 'basket'],
      [/carton|boite|caisse|coffre|bac|malle|lit/, 'box'],
    ],
    'file-box',
  );
}

const CATEGORY_ICONS: Record<string, IconName> = {
  Alimentaire: 'pot-of-food',
  Boissons: 'juice',
  Surgelés: 'ice',
  Hygiène: 'soap',
  Entretien: 'sponge',
  Pharmacie: 'pill',
  Bricolage: 'toolbox',
  Linge: 'shirt',
  Cuisine: 'cooking',
  Électronique: 'plug',
  Papeterie: 'memo',
  Loisirs: 'die',
  Autre: 'box',
};

/** Subcategory icons, keyed "Category/Subcategory" (missing = the category icon). */
const SUBCATEGORY_ICONS: Record<string, IconName> = {
  'Alimentaire/Viande': 'meat',
  'Alimentaire/Poisson': 'fish',
  'Alimentaire/Fruits': 'apple',
  'Alimentaire/Légumes': 'carrot',
  'Alimentaire/Crèmerie': 'cheese',
  'Alimentaire/Épicerie sèche': 'pasta',
  'Alimentaire/Conserves': 'canned-food',
  'Alimentaire/Condiments & épices': 'salt',
  'Alimentaire/Petit-déjeuner': 'croissant',
  'Alimentaire/Snacks & desserts': 'cookie',
  'Alimentaire/Boulangerie': 'bread',
  'Alimentaire/Traiteur': 'shallow-pan',
  'Boissons/Eau': 'droplet',
  'Boissons/Lait': 'milk',
  'Boissons/Café & thé': 'coffee',
  'Boissons/Alcool': 'wine',
  'Surgelés/Desserts': 'ice-cream',
  'Hygiène/Dents': 'toothbrush',
  'Hygiène/Visage': 'lotion',
  'Hygiène/Papier & coton': 'toilet-paper',
  'Hygiène/Bébé': 'baby',
  'Entretien/Lessive': 'laundry',
  'Entretien/Ménage': 'broom',
  'Entretien/Poubelles': 'wastebasket',
  'Entretien/Papier & emballages': 'toilet-paper',
  'Pharmacie/Soins': 'bandage',
  'Pharmacie/Matériel médical': 'thermometer',
  'Bricolage/Outils': 'hammer',
  'Bricolage/Quincaillerie': 'bolt',
  'Bricolage/Piles': 'battery',
  'Bricolage/Peinture': 'paintbrush',
  'Bricolage/Jardin': 'seedling',
  'Linge/Linge de lit': 'bed',
  'Linge/Linge de bain': 'bathtub',
  'Linge/Chaussures': 'shoe',
  'Cuisine/Vaisselle': 'dining',
  'Cuisine/Ustensiles': 'spoon',
  'Cuisine/Rangement': 'box',
  'Électronique/Audio & vidéo': 'headphone',
  'Électronique/Stockage': 'floppy-disk',
  'Électronique/Informatique': 'laptop',
  'Électronique/Téléphonie': 'phone',
  'Papeterie/Écriture': 'pencil',
  'Papeterie/Courrier': 'envelope',
  'Papeterie/Fournitures': 'paperclip',
  'Papeterie/Impression': 'printer',
  'Loisirs/Jeux': 'puzzle',
  'Loisirs/Livres': 'books',
  'Loisirs/Sport': 'ball',
  'Loisirs/Loisirs créatifs': 'palette',
  'Loisirs/Musique': 'guitar',
  'Autre/Animaux': 'paw',
  'Autre/Maison': 'home',
  'Autre/Décoration': 'frame',
};

/** Illustration of an item, from its category / subcategory. */
export function categoryIcon(category: string | null, subcategory: string | null): IconName {
  if (!category) return 'box';
  return SUBCATEGORY_ICONS[`${category}/${subcategory}`] ?? CATEGORY_ICONS[category] ?? 'box';
}

// ---------- Offline autocomplete dictionary ----------

export type CatalogEntry = { name: string; unit: UnitKey; category: string; subcategory: string | null };

/** Format: "Name|unit|Category|Subcategory" — deliberately easy to extend. */
const RAW = `
Pâtes|g|Alimentaire|Épicerie sèche
Riz|g|Alimentaire|Épicerie sèche
Semoule|g|Alimentaire|Épicerie sèche
Quinoa|g|Alimentaire|Épicerie sèche
Lentilles|g|Alimentaire|Épicerie sèche
Pois chiches|g|Alimentaire|Épicerie sèche
Haricots rouges|g|Alimentaire|Épicerie sèche
Farine|kg|Alimentaire|Épicerie sèche
Sucre|kg|Alimentaire|Épicerie sèche
Sucre glace|g|Alimentaire|Épicerie sèche
Sel|g|Alimentaire|Condiments & épices
Poivre|g|Alimentaire|Condiments & épices
Huile d'olive|l|Alimentaire|Condiments & épices
Huile de tournesol|l|Alimentaire|Condiments & épices
Vinaigre|ml|Alimentaire|Condiments & épices
Moutarde|g|Alimentaire|Condiments & épices
Mayonnaise|g|Alimentaire|Condiments & épices
Ketchup|g|Alimentaire|Condiments & épices
Sauce soja|ml|Alimentaire|Condiments & épices
Sauce tomate|g|Alimentaire|Condiments & épices
Concentré de tomate|g|Alimentaire|Conserves
Tomates pelées|pcs|Alimentaire|Conserves
Thon en boîte|pcs|Alimentaire|Conserves
Sardines|pcs|Alimentaire|Conserves
Maïs en boîte|pcs|Alimentaire|Conserves
Petits pois|pcs|Alimentaire|Conserves
Haricots verts|pcs|Alimentaire|Conserves
Soupe|portion|Alimentaire|Traiteur
Bouillon cube|pcs|Alimentaire|Condiments & épices
Café|g|Alimentaire|Petit-déjeuner
Capsules de café|pcs|Alimentaire|Petit-déjeuner
Thé|pcs|Alimentaire|Petit-déjeuner
Chocolat|g|Alimentaire|Snacks & desserts
Chocolat en poudre|g|Alimentaire|Petit-déjeuner
Céréales|g|Alimentaire|Petit-déjeuner
Biscuits|paquet|Alimentaire|Snacks & desserts
Gâteaux apéritif|paquet|Alimentaire|Snacks & desserts
Chips|paquet|Alimentaire|Snacks & desserts
Pain de mie|paquet|Alimentaire|Boulangerie
Pain|pcs|Alimentaire|Boulangerie
Biscottes|paquet|Alimentaire|Petit-déjeuner
Confiture|pcs|Alimentaire|Petit-déjeuner
Miel|g|Alimentaire|Petit-déjeuner
Pâte à tartiner|g|Alimentaire|Petit-déjeuner
Levure|pcs|Alimentaire|Épicerie sèche
Fécule de maïs|g|Alimentaire|Épicerie sèche
Épices|pcs|Alimentaire|Condiments & épices
Herbes de Provence|g|Alimentaire|Condiments & épices
Lait|l|Boissons|Lait
Lait végétal|l|Boissons|Lait
Beurre|g|Alimentaire|Crèmerie
Crème fraîche|ml|Alimentaire|Crèmerie
Yaourts|pcs|Alimentaire|Crèmerie
Fromage râpé|g|Alimentaire|Crèmerie
Fromage|g|Alimentaire|Crèmerie
Œufs|pcs|Alimentaire|Crèmerie
Jambon|portion|Alimentaire|Viande
Lardons|g|Alimentaire|Viande
Poulet|g|Alimentaire|Viande
Steak haché|pcs|Alimentaire|Viande
Saucisses|pcs|Alimentaire|Viande
Poisson|g|Alimentaire|Poisson
Tofu|g|Alimentaire|Traiteur
Pâte feuilletée|pcs|Alimentaire|Traiteur
Pâte brisée|pcs|Alimentaire|Traiteur
Pommes de terre|kg|Alimentaire|Légumes
Oignons|pcs|Alimentaire|Légumes
Ail|pcs|Alimentaire|Légumes
Carottes|kg|Alimentaire|Légumes
Tomates|pcs|Alimentaire|Légumes
Courgettes|pcs|Alimentaire|Légumes
Salade|pcs|Alimentaire|Légumes
Pommes|pcs|Alimentaire|Fruits
Bananes|pcs|Alimentaire|Fruits
Citrons|pcs|Alimentaire|Fruits
Oranges|pcs|Alimentaire|Fruits
Restes|portion|Alimentaire|Traiteur
Plat préparé|portion|Alimentaire|Traiteur
Compote|pcs|Alimentaire|Snacks & desserts
Eau|l|Boissons|Eau
Eau gazeuse|l|Boissons|Eau
Jus d'orange|l|Boissons|Jus & sodas
Soda|l|Boissons|Jus & sodas
Sirop|l|Boissons|Jus & sodas
Bière|pcs|Boissons|Alcool
Vin rouge|pcs|Boissons|Alcool
Vin blanc|pcs|Boissons|Alcool
Rosé|pcs|Boissons|Alcool
Champagne|pcs|Boissons|Alcool
Pastis|l|Boissons|Alcool
Légumes surgelés|g|Surgelés|Légumes
Frites surgelées|kg|Surgelés|Légumes
Pizza surgelée|pcs|Surgelés|Plats préparés
Glace|ml|Surgelés|Desserts
Poisson pané|pcs|Surgelés|Poisson
Épinards surgelés|g|Surgelés|Légumes
Glaçons|paquet|Surgelés|Glaçons
Papier toilette|pcs|Hygiène|Papier & coton
Mouchoirs|paquet|Hygiène|Papier & coton
Gel douche|ml|Hygiène|Corps
Shampoing|ml|Hygiène|Cheveux
Après-shampoing|ml|Hygiène|Cheveux
Savon|pcs|Hygiène|Corps
Dentifrice|pcs|Hygiène|Dents
Brosse à dents|pcs|Hygiène|Dents
Déodorant|pcs|Hygiène|Corps
Rasoirs|pcs|Hygiène|Rasage
Mousse à raser|pcs|Hygiène|Rasage
Coton-tiges|paquet|Hygiène|Papier & coton
Cotons démaquillants|paquet|Hygiène|Papier & coton
Crème hydratante|ml|Hygiène|Corps
Crème solaire|ml|Hygiène|Corps
Serviettes hygiéniques|paquet|Hygiène|Hygiène féminine
Tampons|paquet|Hygiène|Hygiène féminine
Couches|pcs|Hygiène|Bébé
Lingettes|paquet|Hygiène|Bébé
Liquide vaisselle|ml|Entretien|Vaisselle
Tablettes lave-vaisselle|pcs|Entretien|Vaisselle
Lessive|l|Entretien|Lessive
Adoucissant|l|Entretien|Lessive
Javel|l|Entretien|Ménage
Vinaigre ménager|l|Entretien|Ménage
Bicarbonate de soude|g|Entretien|Ménage
Nettoyant multi-usage|ml|Entretien|Ménage
Éponges|pcs|Entretien|Ménage
Sacs poubelle|pcs|Entretien|Poubelles
Papier essuie-tout|pcs|Entretien|Papier & emballages
Film alimentaire|pcs|Entretien|Papier & emballages
Papier aluminium|pcs|Entretien|Papier & emballages
Papier cuisson|pcs|Entretien|Papier & emballages
Sacs congélation|pcs|Entretien|Papier & emballages
Gants ménage|pcs|Entretien|Ménage
Pansements|pcs|Pharmacie|Soins
Paracétamol|pcs|Pharmacie|Médicaments
Désinfectant|ml|Pharmacie|Soins
Compresses|pcs|Pharmacie|Soins
Thermomètre|pcs|Pharmacie|Matériel médical
Sérum physiologique|pcs|Pharmacie|Médicaments
Masques|pcs|Pharmacie|Matériel médical
Ampoules|pcs|Bricolage|Électricité
Piles AA|pcs|Bricolage|Piles
Piles AAA|pcs|Bricolage|Piles
Vis|pcs|Bricolage|Quincaillerie
Clous|pcs|Bricolage|Quincaillerie
Chevilles|pcs|Bricolage|Quincaillerie
Tournevis|pcs|Bricolage|Outils
Marteau|pcs|Bricolage|Outils
Perceuse|pcs|Bricolage|Outils
Mètre ruban|pcs|Bricolage|Outils
Scotch|pcs|Bricolage|Colles & adhésifs
Ruban adhésif|m|Bricolage|Colles & adhésifs
Câble électrique|m|Bricolage|Électricité
Rallonge électrique|pcs|Bricolage|Électricité
Multiprise|pcs|Bricolage|Électricité
Colle|pcs|Bricolage|Colles & adhésifs
Peinture|l|Bricolage|Peinture
Pinceaux|pcs|Bricolage|Peinture
Corde|m|Bricolage|Quincaillerie
Fil de fer|m|Bricolage|Quincaillerie
Tissu|m|Linge|Linge de maison
Draps|pcs|Linge|Linge de lit
Housse de couette|pcs|Linge|Linge de lit
Taies d'oreiller|pcs|Linge|Linge de lit
Serviettes de bain|pcs|Linge|Linge de bain
Torchons|pcs|Linge|Linge de maison
Couverture|pcs|Linge|Linge de lit
T-shirts|pcs|Linge|Vêtements
Chaussettes|pcs|Linge|Vêtements
Pulls|pcs|Linge|Vêtements
Pantalons|pcs|Linge|Vêtements
Assiettes|pcs|Cuisine|Vaisselle
Verres|pcs|Cuisine|Vaisselle
Bols|pcs|Cuisine|Vaisselle
Tasses|pcs|Cuisine|Vaisselle
Couverts|pcs|Cuisine|Vaisselle
Casseroles|pcs|Cuisine|Cuisson
Poêles|pcs|Cuisine|Cuisson
Boîtes de conservation|pcs|Cuisine|Rangement
Câble USB-C|pcs|Électronique|Câbles & chargeurs
Câble HDMI|pcs|Électronique|Câbles & chargeurs
Chargeur|pcs|Électronique|Câbles & chargeurs
Écouteurs|pcs|Électronique|Audio & vidéo
Batterie externe|pcs|Électronique|Câbles & chargeurs
Clé USB|pcs|Électronique|Stockage
Disque dur|pcs|Électronique|Stockage
Télécommande|pcs|Électronique|Audio & vidéo
Stylos|pcs|Papeterie|Écriture
Crayons|pcs|Papeterie|Écriture
Cahiers|pcs|Papeterie|Papier
Ramette de papier|paquet|Papeterie|Papier
Enveloppes|pcs|Papeterie|Courrier
Timbres|pcs|Papeterie|Courrier
Ciseaux|pcs|Papeterie|Fournitures
Cartouches d'encre|pcs|Papeterie|Impression
Jeux de société|pcs|Loisirs|Jeux
Livres|pcs|Loisirs|Livres
Jeux vidéo|pcs|Loisirs|Jeux
Bougies|pcs|Autre|Maison
Allumettes|pcs|Autre|Maison
Croquettes|kg|Autre|Animaux
Litière|kg|Autre|Animaux
`;

export const CATALOG: CatalogEntry[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [name, unit, category, subcategory] = line.split('|');
    return { name, unit: unit as UnitKey, category, subcategory: subcategory || null };
  });

export type Suggestion = CatalogEntry & { source: 'history' | 'catalog' };

/**
 * Ranked suggestions: what the user already entered first,
 * then the dictionary. Word-start matching only.
 */
export function suggest(
  query: string,
  history: { name: string; unit: UnitKey | null; category: string | null; subcategory: string | null }[],
  limit = 6,
): Suggestion[] {
  const q = normalize(query);
  if (!q) return [];

  const pool: Suggestion[] = [
    ...history.map((h) => ({
      name: h.name,
      unit: h.unit ?? 'pcs',
      category: h.category ?? '',
      subcategory: h.subcategory,
      source: 'history' as const,
    })),
    ...CATALOG.map((c) => ({ ...c, source: 'catalog' as const })),
  ];

  // Word start only: "poul" suggests "Poulet", not "Ampoules".
  // Order: exact name, then "starts with", then another word of the name matching.
  const seen = new Set<string>();
  const exact: Suggestion[] = [];
  const starts: Suggestion[] = [];
  const others: Suggestion[] = [];
  for (const s of pool) {
    const n = normalize(s.name);
    if (seen.has(n)) continue;
    if (n === q) exact.push(s);
    else if (n.startsWith(q)) starts.push(s);
    else if (matchesWordStart(n, q)) others.push(s);
    else continue;
    seen.add(n);
  }
  return [...exact, ...starts, ...others].slice(0, limit);
}
