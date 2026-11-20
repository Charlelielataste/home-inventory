import type { Item, ItemInput } from '@/db/queries';
import { giveFeedback } from '@/lib/feedback';
import { formatNumber, formatStock } from '@/lib/units';
import { showDialog } from '@/ui/components';

export type DuplicateChoice = 'merge' | 'separate' | 'cancel';

/**
 * A new item already here (same name, size and frozen state): asks what to do.
 * Adding: « Additionner » (merge) / « Créer à part » (separate). To buy: already on the list
 * = just a message, otherwise « Ajouter à part ». Back / outside the card = cancel.
 */
export function resolveDuplicate(duplicate: Item, input: ItemInput, toBuy: boolean): Promise<DuplicateChoice> {
  // The save key plays nothing (the save plays `success`): the dialog opening does
  giveFeedback('tap');
  return new Promise((resolve) => {
    const cancel = { text: 'Annuler', style: 'cancel' as const, onPress: () => resolve('cancel') };
    if (toBuy) {
      const listed = duplicate.min_quantity !== null && duplicate.quantity <= duplicate.min_quantity;
      return showDialog({
        title: listed ? 'Déjà sur la liste' : 'Déjà présent',
        message: listed
          ? `« ${duplicate.name} » est déjà dans tes courses.`
          : `« ${duplicate.name} » est déjà ici (${formatStock(duplicate, { pieces: true })}). L’ajouter quand même à la liste, à part ?`,
        buttons: listed
          ? [{ ...cancel, text: 'OK' }]
          : [{ text: 'Ajouter à part', style: 'primary', feedback: false, onPress: () => resolve('separate') }, cancel],
      });
    }
    showDialog({
      title: 'Déjà présent',
      // The quantity saved (raised when more is left than the items typed can hold)
      message: `« ${duplicate.name} » est déjà ici (${formatStock(duplicate)}). Ajouter ${formatNumber(input.quantity)} au stock existant ?`,
      buttons: [
        { text: 'Additionner', style: 'primary', feedback: false, onPress: () => resolve('merge') },
        { text: 'Créer à part', feedback: false, onPress: () => resolve('separate') },
        cancel,
      ],
    });
  });
}
