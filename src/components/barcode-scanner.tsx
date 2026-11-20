import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { giveFeedback } from '@/lib/feedback';
import { Button, IconButton } from '@/ui/components';
import { colors, font, fonts, radius, spacing } from '@/ui/theme';

type Props = {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
  /**
   * Quick scan: the camera stays open for the next product. A code is read again only once
   * it has left the camera for `RESCAN_AFTER_MS` (no double count while the product is held).
   */
  continuous?: boolean;
  /** Result of the last scan, shown over the camera (continuous mode) */
  status?: string | null;
  /** false: no `scan` sound, the caller plays the outcome's (quick scan: `success`) */
  feedback?: boolean;
  /** Instruction under the frame */
  hint?: string;
  /** iOS: the camera is fully closed (only then can another modal screen be presented) */
  onDismiss?: () => void;
};

/** Continuous mode: time without seeing the last code before reading again. */
const RESCAN_AFTER_MS = 1200;

export function BarcodeScanner({
  visible,
  onScanned,
  onClose,
  continuous,
  feedback = true,
  status,
  hint,
  onDismiss,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const locked = useRef(false);
  const lastCode = useRef<string | null>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    },
    [],
  );

  /** Continuous mode: unlocks once the last code has not been seen for a while. */
  const unlockLater = () => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      locked.current = false;
      lastCode.current = null;
    }, RESCAN_AFTER_MS);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      onShow={() => {
        locked.current = false;
        lastCode.current = null;
      }}>
      <View style={{ flex: 1, backgroundColor: colors.camera }}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => {
              if (locked.current) {
                // Still in front of the camera: wait again before reading it once more
                if (continuous && data === lastCode.current) unlockLater();
                return;
              }
              locked.current = true;
              lastCode.current = data;
              if (feedback) giveFeedback('scan');
              onScanned(data);
              if (continuous) unlockLater();
            }}
          />
        ) : (
          <View style={styles.permission}>
            <Text style={[font.heading, { color: colors.overlay, textAlign: 'center' }]}>
              L’appareil photo est nécessaire pour scanner les codes-barres.
            </Text>
            <Button
              title={permission?.canAskAgain === false ? 'Autoriser dans les réglages' : "Autoriser l'appareil photo"}
              variant="secondary"
              style={{ backgroundColor: colors.overlay }}
              onPress={permission?.canAskAgain === false ? () => Linking.openSettings() : requestPermission}
            />
          </View>
        )}

        {permission?.granted && (
          <>
            <View style={[styles.frame, { pointerEvents: 'none' }]} />
            {!!status && (
              <View style={[styles.status, { bottom: insets.bottom + 84 }]}>
                <Text style={styles.statusText}>{status}</Text>
              </View>
            )}
            <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>
              {hint ?? 'Vise le code-barres du produit'}
            </Text>
          </>
        )}

        <View style={[styles.close, { top: insets.top + spacing.sm }]}>
          <IconButton icon="close" label="Fermer" size={24} color={colors.overlay} feedback="close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  permission: { flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  frame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '38%',
    height: 150,
    borderWidth: 3,
    borderColor: colors.overlay,
    borderRadius: radius.sm + 2,
  },
  // Dark round behind the white cross: stays visible over a bright camera image
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backdrop,
  },
  // Result of the last quick scan: dark pill, readable over any camera image
  status: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  statusText: {
    ...font.bodyStrong,
    backgroundColor: colors.backdrop,
    color: colors.overlay,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.overlay,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
});
