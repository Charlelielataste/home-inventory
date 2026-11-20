/**
 * Item form: what moving an item to another furniture does to its frozen state.
 * Into a freezer = frozen; out of it = thawed, eat soon (THAWED_SHELF_DAYS).
 */
import { addToToday, isoToFr, THAWED_SHELF_DAYS, todayIso } from './dates';
import type { Lots } from './stock-form';

export type FreezerFields = {
  frozenAt: string | null;
  /** Single expiry date, as typed (JJ/MM/AAAA) */
  expiresText: string;
  lots: Lots | null;
  /** Taken out of the freezer in this form: the expiry date it was given, null otherwise */
  thawedUntil: string | null;
};

/** The item as last saved (null: a new item). */
export type SavedFreezer = { frozenAt: string | null; expiresText: string; lots: Lots | null } | null;

/**
 * The fields to change when the item moves from one furniture to another (null = nothing).
 * `canFreeze`: the « Congelé » box is shown for the category.
 */
export function locationChange(
  current: FreezerFields,
  move: { fromFreezer: boolean; toFreezer: boolean; canFreeze: boolean; saved: SavedFreezer },
): Partial<FreezerFields> | null {
  const { fromFreezer, toFreezer, canFreeze, saved } = move;

  if (toFreezer && !current.frozenAt && canFreeze) {
    // Saved as frozen: back in a freezer, still the same frozen item (frozen since the same
    // day, so its snoozed reminder is kept). Taken out in this form: its dates come back too.
    if (saved?.frozenAt) {
      return current.thawedUntil
        ? { frozenAt: saved.frozenAt, expiresText: saved.expiresText, lots: saved.lots, thawedUntil: null }
        : { frozenAt: saved.frozenAt, thawedUntil: null };
    }
    // Moved into a freezer: automatically marked as frozen
    return { frozenAt: todayIso(), thawedUntil: null };
  }

  if (!toFreezer && fromFreezer && current.frozenAt) {
    // Not saved as frozen yet: just a location change, keep the expiry date that was entered
    if (!saved?.frozenAt) return { frozenAt: null };
    // Taken out of the freezer: thawed, eat soon
    const limit = addToToday({ days: THAWED_SHELF_DAYS });
    return { frozenAt: null, expiresText: isoToFr(limit), lots: null, thawedUntil: limit };
  }

  return null;
}

/** Shown under the expiry date once taken out of the freezer. */
export function thawNote(thawedUntil: string): string {
  return `Sorti du congélateur : date de péremption mise au ${isoToFr(thawedUntil)} (${THAWED_SHELF_DAYS} jours après décongélation). Modifie-la si besoin.`;
}
