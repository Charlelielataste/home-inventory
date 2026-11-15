import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, IconButton } from '@/ui/components';
import { colors, font, fonts, spacing } from '@/ui/theme';

type Props = {
  visible: boolean;
  onScanned: (barcode: string) => void;
  onClose: () => void;
};

export function BarcodeScanner({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const locked = useRef(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        locked.current = false;
      }}>
      <View style={{ flex: 1, backgroundColor: colors.text }}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => {
              if (locked.current) return;
              locked.current = true;
              onScanned(data);
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
            <Text style={[styles.hint, { bottom: insets.bottom + 40 }]}>Vise le code-barres du produit</Text>
          </>
        )}

        <View style={[styles.close, { top: insets.top + spacing.sm }]}>
          <IconButton icon="close" label="Fermer" size={24} color={colors.overlay} onPress={onClose} />
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
    borderRadius: 12,
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
  hint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.overlay, fontFamily: fonts.medium, fontSize: 16 },
});
