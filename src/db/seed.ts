import type { SQLiteDatabase } from 'expo-sqlite';

import { addToToday } from '@/lib/dates';

import { addStock, createFurniture, createItem, createRoom, type ItemInput } from './queries';

/**
 * Demo data, development builds only (Réglages, `__DEV__`): fills the Péremption and
 * Courses tabs (expired, expiring soon, long frozen, low stock, out of stock).
 * Added next to the current data, nothing is deleted.
 */

/** Date in `days` days (negative = in the past), ISO. */
const inDays = (days: number) => addToToday({ days });

type Demo = Partial<ItemInput> & Pick<ItemInput, 'name' | 'quantity'>;

const item = (furnitureId: number, demo: Demo): ItemInput => ({
  furniture_id: furnitureId,
  icon: null,
  size: null,
  size_unit: null,
  amount: null,
  category: 'Alimentaire',
  subcategory: null,
  min_quantity: null,
  expires_at: null,
  frozen_at: null,
  barcode: null,
  notes: null,
  ...demo,
});

export async function seedDemoData(db: SQLiteDatabase) {
  // No outer transaction: each item write runs its own (see `serialized()` in queries.ts)
  const kitchen = await createRoom(db, 'Cuisine (démo)');
  const fridge = await createFurniture(db, kitchen, 'Frigo');
  const freezer = await createFurniture(db, kitchen, 'Congélateur');
  const cupboard = await createFurniture(db, kitchen, 'Placard');
  const bathroom = await createRoom(db, 'Salle de bain (démo)');
  const cabinet = await createFurniture(db, bathroom, 'Armoire à pharmacie');
  const garage = await createRoom(db, 'Garage (démo)');
  const shelf = await createFurniture(db, garage, 'Étagère');

  const items: ItemInput[] = [
    // Expired
    item(fridge, {
      name: 'Yaourts nature',
      quantity: 4,
      size: 125,
      size_unit: 'g',
      subcategory: 'Crèmerie',
      expires_at: inDays(-2),
    }),
    item(fridge, { name: 'Jambon', quantity: 1, subcategory: 'Viande', expires_at: inDays(-1) }),
    item(cabinet, {
      name: 'Sirop pour la toux',
      quantity: 1,
      size: 200,
      size_unit: 'ml',
      amount: 80,
      category: 'Pharmacie',
      expires_at: inDays(-30),
    }),
    // Expiring soon
    item(fridge, {
      name: 'Lait demi-écrémé',
      quantity: 2,
      size: 1,
      size_unit: 'l',
      amount: 1.5,
      category: 'Boissons',
      subcategory: 'Lait',
      min_quantity: 2,
      expires_at: inDays(0),
    }),
    item(fridge, {
      name: 'Poulet',
      quantity: 2,
      size: 500,
      size_unit: 'g',
      subcategory: 'Viande',
      expires_at: inDays(1),
    }),
    item(fridge, {
      name: 'Fromage râpé',
      quantity: 1,
      size: 200,
      size_unit: 'g',
      amount: 120,
      subcategory: 'Crèmerie',
      expires_at: inDays(3),
    }),
    item(fridge, { name: 'Œufs', quantity: 6, subcategory: 'Crèmerie', min_quantity: 6, expires_at: inDays(6) }),
    // Fine for now
    item(cupboard, {
      name: 'Pâtes',
      quantity: 3,
      size: 500,
      size_unit: 'g',
      subcategory: 'Épicerie sèche',
      min_quantity: 1,
      expires_at: inDays(200),
    }),
    // Frozen for 4 months (default reminder: 3), and one frozen recently
    item(freezer, {
      name: 'Steaks hachés',
      quantity: 4,
      size: 100,
      size_unit: 'g',
      subcategory: 'Viande',
      expires_at: inDays(-90),
      frozen_at: addToToday({ months: -4 }),
    }),
    item(freezer, {
      name: 'Soupe maison',
      quantity: 2,
      size: 500,
      size_unit: 'ml',
      subcategory: 'Traiteur',
      frozen_at: inDays(-10),
    }),
    // Low stock / out of stock (Courses)
    item(cupboard, {
      name: 'Riz',
      quantity: 1,
      size: 1,
      size_unit: 'kg',
      amount: 0.3,
      subcategory: 'Épicerie sèche',
      min_quantity: 1,
    }),
    item(cupboard, {
      name: 'Café moulu',
      quantity: 0,
      size: 250,
      size_unit: 'g',
      amount: 0,
      category: 'Boissons',
      subcategory: 'Café & thé',
      min_quantity: 1,
    }),
    // More than 8 items in the Placard: shows its filter field
    item(cupboard, { name: 'Farine', quantity: 1, size: 1, size_unit: 'kg', subcategory: 'Épicerie sèche' }),
    item(cupboard, { name: 'Sucre en poudre', quantity: 1, size: 1, size_unit: 'kg', subcategory: 'Épicerie sèche' }),
    item(cupboard, { name: 'Lentilles', quantity: 2, size: 500, size_unit: 'g', subcategory: 'Épicerie sèche' }),
    item(cupboard, { name: 'Thon en boîte', quantity: 3, size: 140, size_unit: 'g', subcategory: 'Conserves' }),
    item(cupboard, { name: 'Tomates pelées', quantity: 2, size: 400, size_unit: 'g', subcategory: 'Conserves' }),
    item(cupboard, {
      name: 'Huile d’olive',
      quantity: 1,
      size: 1,
      size_unit: 'l',
      amount: 0.6,
      subcategory: 'Condiments & épices',
    }),
    item(cupboard, { name: 'Céréales', quantity: 1, size: 375, size_unit: 'g', subcategory: 'Petit-déjeuner' }),
    item(cabinet, { name: 'Dentifrice', quantity: 1, category: 'Hygiène', min_quantity: 2 }),
    item(shelf, { name: 'Piles AA', quantity: 2, category: 'Électronique', min_quantity: 4 }),
    item(shelf, {
      name: 'Liquide vaisselle',
      quantity: 0,
      size: 500,
      size_unit: 'ml',
      amount: 0,
      category: 'Entretien',
      min_quantity: 1,
    }),
  ];
  for (const i of items) await createItem(db, i);

  // Partly dated (home banner « dates manquantes »): 2 yogurts with a date, 1 bought without one
  const yogurts = await createItem(
    db,
    item(fridge, { name: 'Yaourts aux fruits', quantity: 2, subcategory: 'Crèmerie', expires_at: inDays(10) }),
  );
  await addStock(db, yogurts, 1, null);
}
