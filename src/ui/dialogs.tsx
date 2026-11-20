import { type ReactNode, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Feedback, giveFeedback, withFeedback } from '@/lib/feedback';

import { Button } from './buttons';
import { colors, font, radius, spacing } from './theme';

/**
 * Skeleton of every themed modal: transparent fading <Modal>, dimmed backdrop (a tap on it
 * or the back button calls `onClose`, which plays its own feedback), content centered.
 * `avoidKeyboard`: the content is pushed up above the keyboard (put `modalCardStyle` with
 * `flexShrink: 1` on the card so it shrinks instead of overflowing).
 */
export function ModalFrame({
  visible,
  onClose,
  onDismiss,
  avoidKeyboard,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** iOS: called once the modal is fully closed */
  onDismiss?: () => void;
  avoidKeyboard?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const backdrop = <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior="padding"
          style={[styles.modalBackdrop, { paddingTop: insets.top + spacing.lg }]}>
          {backdrop}
          {children}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.modalBackdrop}>
          {backdrop}
          {children}
        </View>
      )}
    </Modal>
  );
}

/** Card of a themed modal (ModalCard, PromptModal, dialogs). */
export const modalCardStyle = {
  backgroundColor: colors.background,
  borderRadius: radius.lg + 4,
  padding: spacing.lg + 4,
  gap: spacing.md,
};

/**
 * Centered modal card (themed, like the dialogs): title, optional subtitle, free content.
 * The back button and a tap outside the card call `onClose`.
 * `avoidKeyboard`: for a card holding a text field (stays above the keyboard).
 */
export function ModalCard({
  visible,
  title,
  subtitle,
  onClose,
  avoidKeyboard,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  avoidKeyboard?: boolean;
  children: ReactNode;
}) {
  return (
    <ModalFrame visible={visible} onClose={withFeedback('close', onClose)} avoidKeyboard={avoidKeyboard}>
      <View style={[modalCardStyle, avoidKeyboard && { flexShrink: 1 }]} accessibilityViewIsModal>
        <View style={{ gap: spacing.sm }}>
          <Text style={font.title}>{title}</Text>
          {!!subtitle && <Text style={[font.body, { color: colors.textMuted }]}>{subtitle}</Text>}
        </View>
        {children}
      </View>
    </ModalFrame>
  );
}

// ---------- Dialogs ----------
// Themed replacement for the native Alert.alert (never use it in the app):
// showDialog() from anywhere, rendered by the single <DialogHost /> of the root layout.

type DialogButton = {
  text: string;
  /** cancel: ghost, at the bottom, also used by the back button / backdrop · destructive: red · primary: lagoon · default: cream */
  style?: 'default' | 'primary' | 'cancel' | 'destructive';
  onPress?: () => void;
  /**
   * Sound / vibration on press. Defaults: cancel → close, destructive → none (the action
   * plays `delete` once done), others → tap. false when the action plays its own (e.g. success).
   */
  feedback?: Feedback | false;
};
type DialogSpec = { title: string; message?: string; buttons?: DialogButton[] };

/** Mounted hosts, the last one shows the dialogs (see DialogHost). */
const dialogHosts: ((spec: DialogSpec) => void)[] = [];

export function showDialog(spec: DialogSpec) {
  const host = dialogHosts[dialogHosts.length - 1];
  if (!host) console.warn('[dialog] <DialogHost /> is not mounted');
  host?.(spec);
}

/** Information message with a single "OK". */
export function showMessage(title: string, message?: string) {
  showDialog({ title, message });
}

/** Same, for something that went wrong (invalid input, failed export…): plays the error feedback. */
export function showError(title: string, message?: string) {
  giveFeedback('error');
  showDialog({ title, message });
}

export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void) {
  showDialog({
    title,
    message,
    buttons: [
      { text: confirmLabel, style: 'destructive', onPress: onConfirm },
      { text: 'Annuler', style: 'cancel' },
    ],
  });
}

/** "Edit (name + icon) / Delete" menu. */
export function showEditDeleteMenu(name: string, onEdit: () => void, onDelete: () => void) {
  showDialog({
    title: name,
    buttons: [
      { text: 'Modifier', onPress: onEdit },
      { text: 'Supprimer', style: 'destructive', onPress: onDelete },
      { text: 'Annuler', style: 'cancel' },
    ],
  });
}

function defaultDialogFeedback(style: DialogButton['style']): Feedback | false {
  if (!style || style === 'default' || style === 'primary') return 'tap';
  return style === 'cancel' ? 'close' : false;
}

const DIALOG_VARIANTS = { default: 'secondary', primary: 'primary', destructive: 'danger', cancel: 'ghost' } as const;

/**
 * Renders the dialogs. One in the root layout; screens presented as a native modal
 * (item form) mount their own, because on iOS a root <Modal> cannot appear above them.
 */
export function DialogHost() {
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  // iOS cannot present a modal while another one is closing: run the action once closed
  const pending = useRef<(() => void) | null>(null);
  // False once a button was pressed: a fast double tap must not run the action twice
  const open = useRef(false);
  useEffect(() => {
    const show = (spec: DialogSpec) => {
      open.current = true;
      setDialog(spec);
    };
    dialogHosts.push(show);
    return () => {
      dialogHosts.splice(dialogHosts.lastIndexOf(show), 1);
    };
  }, []);

  const buttons: DialogButton[] = dialog?.buttons?.length ? dialog.buttons : [{ text: 'OK', style: 'primary' }];
  // Cancel last, whatever the order given
  const sorted = [...buttons.filter((b) => b.style !== 'cancel'), ...buttons.filter((b) => b.style === 'cancel')];
  const press = (button?: DialogButton) => {
    if (!open.current) return;
    open.current = false;
    // No button: dismissed (backdrop / back) without a cancel button
    const feedback = button ? (button.feedback ?? defaultDialogFeedback(button.style)) : 'close';
    if (feedback) giveFeedback(feedback);
    // Close first: the action may open another dialog or modal
    setDialog(null);
    if (!button?.onPress) return;
    if (Platform.OS === 'ios') pending.current = button.onPress;
    else button.onPress();
  };
  const onDismiss = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const dismiss = () => press(buttons.find((b) => b.style === 'cancel'));

  return (
    <ModalFrame visible={!!dialog} onClose={dismiss} onDismiss={onDismiss}>
      {dialog && (
        <View style={modalCardStyle} accessibilityViewIsModal>
          <Text style={font.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={[font.body, { color: colors.textMuted }]}>{dialog.message}</Text>}
          <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
            {sorted.map((b) => (
              <Button
                key={b.text}
                title={b.text}
                variant={DIALOG_VARIANTS[b.style ?? 'default']}
                feedback={false}
                onPress={() => press(b)}
              />
            ))}
          </View>
        </View>
      )}
    </ModalFrame>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
