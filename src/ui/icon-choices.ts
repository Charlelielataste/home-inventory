import type { IconName } from './icons-data';

/**
 * Illustrations offered in the "Personnalisé" icon grid (rooms, furniture, items),
 * grouped by theme, with the label read by screen readers (French: displayed text).
 * Colored Fluent illustrations only: no Phosphor UI glyphs.
 * To add one: declare it in scripts/build-icons.mjs, rerun it, then list it here.
 */
// prettier-ignore
export const ICON_CHOICES: [IconName, string][] = [
  // House & rooms
  ['home', 'Maison'], ['garden-house', 'Maison avec jardin'], ['door', 'Porte'], ['window', 'Fenêtre'],
  ['kitchen', 'Marmite'], ['couch', 'Canapé'], ['dining', 'Assiette'], ['bed', 'Lit'], ['bathtub', 'Baignoire'],
  ['shower', 'Douche'], ['toilet', 'Toilettes'], ['desk', 'Ordinateur'], ['chair', 'Chaise'], ['car', 'Voiture'],
  ['seedling', 'Pousse'], ['plant', 'Plante'], ['tent', 'Tente'],
  // Storage
  ['box', 'Carton'], ['file-box', 'Boîte de rangement'], ['file-cabinet', 'Classeur'], ['books', 'Livres'],
  ['basket', 'Panier'], ['toolbox', 'Boîte à outils'], ['snowflake', 'Flocon'], ['ice', 'Glaçon'],
  ['locker', 'Cadenas'], ['jar', 'Bocal'], ['coat', 'Manteau'], ['mirror', 'Miroir'], ['tv', 'Télévision'],
  // People & animals
  ['old-woman', 'Mamie'], ['old-man', 'Papi'], ['woman', 'Femme'], ['man', 'Homme'], ['child', 'Enfant'],
  ['baby', 'Biberon'], ['teddy-bear', 'Nounours'], ['dog', 'Chien'], ['cat', 'Chat'], ['rabbit', 'Lapin'],
  ['bird', 'Oiseau'], ['fish', 'Poisson'], ['paw', 'Pattes'],
  // Food & drinks
  ['pot-of-food', 'Plat mijoté'], ['cooking', 'Poêle'], ['shallow-pan', 'Plat cuisiné'], ['pasta', 'Pâtes'],
  ['bread', 'Pain'], ['croissant', 'Croissant'], ['cheese', 'Fromage'], ['egg', 'Œuf'], ['meat', 'Viande'],
  ['apple', 'Pomme'], ['banana', 'Banane'], ['strawberry', 'Fraise'], ['lemon', 'Citron'], ['carrot', 'Carotte'],
  ['tomato', 'Tomate'], ['potato', 'Pomme de terre'], ['onion', 'Oignon'], ['broccoli', 'Brocoli'],
  ['canned-food', 'Conserve'], ['salt', 'Sel'], ['honey', 'Miel'], ['pizza', 'Pizza'], ['hamburger', 'Burger'],
  ['sushi', 'Sushi'], ['cookie', 'Cookie'], ['cupcake', 'Cupcake'], ['candy', 'Bonbon'],
  ['chocolate', 'Chocolat'], ['ice-cream', 'Glace'], ['milk', 'Lait'], ['coffee', 'Café'], ['teapot', 'Théière'],
  ['juice', 'Boisson'], ['droplet', 'Eau'], ['wine', 'Vin'], ['beer', 'Bière'], ['bottle', 'Bouteille'],
  ['spoon', 'Cuillère'], ['kitchen-knife', 'Couteau'],
  // Care & cleaning
  ['soap', 'Savon'], ['toothbrush', 'Brosse à dents'], ['lotion', 'Crème'], ['lipstick', 'Rouge à lèvres'],
  ['toilet-paper', 'Papier toilette'], ['sponge', 'Éponge'], ['broom', 'Balai'], ['bucket', 'Seau'],
  ['laundry', 'Lessive'], ['wastebasket', 'Poubelle'], ['pill', 'Médicament'], ['bandage', 'Pansement'],
  ['thermometer', 'Thermomètre'],
  // Clothes
  ['shirt', 'T-shirt'], ['dress', 'Robe'], ['socks', 'Chaussettes'], ['gloves', 'Gants'], ['scarf', 'Écharpe'],
  ['cap', 'Casquette'], ['shoe', 'Chaussure'], ['handbag', 'Sac à main'], ['backpack', 'Sac à dos'],
  ['briefcase', 'Mallette'], ['luggage', 'Valise'],
  // DIY & tech
  ['hammer', 'Outils'], ['wrench', 'Clé à molette'], ['bolt', 'Vis'], ['ladder', 'Échelle'],
  ['paintbrush', 'Pinceau'], ['battery', 'Pile'], ['plug', 'Prise'], ['light-bulb', 'Ampoule'],
  ['flashlight', 'Lampe torche'], ['candle', 'Bougie'], ['fire-extinguisher', 'Extincteur'], ['key', 'Clé'],
  ['laptop', 'Ordinateur portable'], ['phone', 'Téléphone'], ['headphone', 'Casque audio'],
  ['camera', 'Appareil photo'], ['printer', 'Imprimante'], ['floppy-disk', 'Disquette'],
  // Paper & hobbies
  ['memo', 'Bloc-notes'], ['notebook', 'Cahier'], ['clipboard', 'Presse-papiers'], ['calendar', 'Calendrier'],
  ['pencil', 'Crayon'], ['crayon', 'Craie grasse'], ['envelope', 'Enveloppe'], ['paperclip', 'Trombone'],
  ['pushpin', 'Punaise'], ['scissors', 'Ciseaux'], ['yarn', 'Pelote de laine'], ['palette', 'Palette'],
  ['frame', 'Cadre'], ['guitar', 'Guitare'], ['die', 'Dé'], ['puzzle', 'Puzzle'], ['gamepad', 'Manette'],
  ['ball', 'Ballon'], ['bicycle', 'Vélo'],
  // Celebrations & misc
  ['gift', 'Cadeau'], ['balloon', 'Ballon de fête'], ['christmas-tree', 'Sapin'], ['shopping-bags', 'Sacs'],
  ['umbrella', 'Parapluie'], ['heart', 'Cœur'], ['star', 'Étoile'], ['sparkles', 'Étincelles'],
  ['gem', 'Pierre précieuse'], ['crown', 'Couronne'], ['magic-wand', 'Baguette magique'], ['rocket', 'Fusée'],
];
