import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent, useState } from 'react';

import { findKnownByBarcode } from '@/db/queries';
import { lookupBarcode } from '@/lib/openfoodfacts';
import { formatNumber, type MeasureUnit } from '@/lib/units';

export type ScanStatus = { loading: boolean; message?: string };

/** What a barcode lookup found, to fill the form */
export type ScannedProduct = {
  name: string;
  size: number | null;
  size_unit: MeasureUnit | null;
  category: string | null;
  subcategory: string | null;
  /** Remembered icon of a product already scanned (absent from the open databases) */
  icon?: string | null;
};

/**
 * Barcode of the item form: the scanner, and the lookup of the scanned code (history first,
 * offline, then the open databases). `initialBarcode`: scanned from the furniture screen (quick
 * scan), looked up on open.
 */
export function useBarcodeLookup({
  initialBarcode,
  hasName,
  onProduct,
  onSamePack,
  onOtherProduct,
}: {
  initialBarcode?: string;
  /** A name is typed: the same code scanned again is one more pack of it */
  hasName: boolean;
  /** Product found: fills the form, with `quantity` items (one pack) */
  onProduct: (product: ScannedProduct, quantity: number) => void;
  /** Same product scanned again: `pack` more items */
  onSamePack: (pack: number) => void;
  /** Another product scanned: it replaces the current one */
  onOtherProduct: () => void;
}) {
  const db = useSQLiteContext();
  const [barcode, setBarcode] = useState<string | null>(initialBarcode ?? null);
  /** Items in one pack of the scanned product (6 × 33 cl → 6), remembered with the barcode */
  const [packQuantity, setPackQuantity] = useState<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scan, setScan] = useState<ScanStatus>({ loading: !!initialBarcode });

  const lookUp = async (code: string) => {
    // 1. Already scanned before: works offline
    const known = await findKnownByBarcode(db, code);
    if (known) {
      onProduct(known, known.pack_quantity ?? 1);
      setPackQuantity(known.pack_quantity);
      setScan({ loading: false, message: 'Produit reconnu (déjà scanné).' });
      return;
    }
    // 2. Open Food Facts & co open databases
    setPackQuantity(null);
    try {
      const product = await lookupBarcode(code);
      if (product) {
        onProduct(product, product.quantity ?? 1);
        setPackQuantity(product.quantity);
        setScan({ loading: false, message: 'Produit trouvé sur Open Food Facts.' });
      } else {
        setScan({
          loading: false,
          message: 'Produit inconnu : saisis son nom, il sera associé à ce code-barres pour la prochaine fois.',
        });
      }
    } catch {
      setScan({
        loading: false,
        message: 'Pas de connexion : saisis le nom, le code-barres sera mémorisé.',
      });
    }
  };

  const onScanned = async (code: string) => {
    setScannerOpen(false);

    // Same product scanned again: one more pack (quantity and what is left add up)
    if (code === barcode && hasName) {
      const pack = packQuantity ?? 1;
      onSamePack(pack);
      setScan({ loading: false, message: `Même produit : ${formatNumber(pack)} de plus.` });
      return;
    }

    // Another product: it replaces the current one
    onOtherProduct();
    setBarcode(code);
    setScan({ loading: true });
    await lookUp(code);
  };

  // Opened by the quick scan of a furniture with a product not there yet: look it up
  // (barcode and loading state are already set by the initial state)
  const lookUpOnOpen = useEffectEvent((code: string) => lookUp(code));
  useEffect(() => {
    if (!initialBarcode) return;
    // Async: the lookup only sets its state once the history has answered
    (async () => {
      await lookUpOnOpen(initialBarcode);
    })();
  }, [initialBarcode]);

  return {
    barcode,
    /** Barcode of the saved item */
    setBarcode,
    packQuantity,
    scan,
    scannerOpen,
    openScanner: () => setScannerOpen(true),
    closeScanner: () => setScannerOpen(false),
    onScanned,
  };
}
