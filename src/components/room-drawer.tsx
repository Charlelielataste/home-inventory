import { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type PanResponderGestureState,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FurnitureWithCount, RoomWithCounts } from '@/db/queries';
import { furnitureIconOf, roomIconOf } from '@/lib/catalog';
import { giveFeedback } from '@/lib/feedback';
import { plural } from '@/lib/text';
import { AddTile, IconTile, ListRow } from '@/ui/components';
import { colors, font, radius, spacing } from '@/ui/theme';

import { roomSummary } from './room-tile';

const OPEN_MS = 300;
const CLOSE_MS = 220;
/** Drag down past this distance (or fast enough) closes the drawer */
const DRAG_CLOSE = 90;
const DRAG_CLOSE_VELOCITY = 0.8;

type Props = {
  /** null = closed. Kept by the parent until `onClosed`, so the drawer keeps its content while sliding out */
  room: RoomWithCounts | null;
  furniture: FurnitureWithCount[];
  /** The drawer is gone: the parent forgets the room */
  onClosed: () => void;
  onOpenFurniture: (f: FurnitureWithCount) => void;
  onAddFurniture: (room: RoomWithCounts) => void;
};

/**
 * Drawer of a room (home screen): slides up from the bottom over a dimmed backdrop, with the
 * room header, its furniture (tap = its items) and « Ajouter un rangement ». Closed by the
 * backdrop, the back button or dragging it down. An action (open a piece of
 * furniture, add one) runs once the drawer is gone: on iOS a screen or a modal cannot show
 * while another modal is still on screen.
 */
export function RoomDrawer({ room, furniture, onClosed, onOpenFurniture, onAddFurniture }: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  // 0 = hidden below the screen, 1 = open
  const progress = useSharedValue(0);
  const sheetHeight = useSharedValue(screenHeight);
  const drag = useSharedValue(0);
  // Action to run once the modal is gone
  const pending = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  // List scrolled to the top: a downward drag then moves the drawer instead of the list
  const listAtTop = useRef(true);

  const isOpen = room !== null;
  useEffect(() => {
    if (!isOpen) return;
    closing.current = false;
    // A new list starts at the top (the last one may have been closed scrolled down)
    listAtTop.current = true;
    drag.set(0);
    setVisible(true);
    progress.set(withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) }));
  }, [isOpen, drag, progress]);

  const finish = () => {
    const action = pending.current;
    pending.current = null;
    onClosed();
    action?.();
  };

  const dismiss = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    pending.current = then ?? null;
    progress.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }));
    setTimeout(() => {
      setVisible(false);
      // iOS: wait for the modal to be really gone (onDismiss); Android has no such delay
      if (Platform.OS !== 'ios') finish();
    }, CLOSE_MS);
  };

  const close = () => {
    giveFeedback('close');
    dismiss();
  };

  // The responder is created once: it calls the latest `close`
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  // Drag the drawer down to close it, from anywhere on it (list: once scrolled to the top).
  // Capture phase: taken from the rows / the list as soon as the finger clearly moves down;
  // a simple tap still reaches the rows.
  const [pan] = useState(() => {
    const draggingDown = (g: PanResponderGestureState) =>
      g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5 && listAtTop.current;
    return PanResponder.create({
      // Handle + header: nothing to tap there, the drawer takes the finger right away
      onStartShouldSetPanResponder: (e) => e.nativeEvent.pageY - sheetTop.current < headerHeight.current,
      onMoveShouldSetPanResponder: (_, g) => draggingDown(g),
      onMoveShouldSetPanResponderCapture: (_, g) => draggingDown(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => drag.set(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_CLOSE || g.vy > DRAG_CLOSE_VELOCITY) closeRef.current();
        else drag.set(withTiming(0, { duration: 180 }));
      },
      onPanResponderTerminate: () => drag.set(withTiming(0, { duration: 180 })),
    });
  });
  // Where the sheet starts on screen and how tall its handle + header are (start of a drag)
  const sheetTop = useRef(0);
  const headerHeight = useRef(0);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * sheetHeight.get() + drag.get() }],
  }));
  const onSheetLayout = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    sheetHeight.set(height);
    sheetTop.current = screenHeight - height;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={close}
      onDismiss={() => Platform.OS === 'ios' && finish()}
      statusBarTranslucent
      navigationBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer" />
        </Animated.View>
        {room && (
          <Animated.View
            onLayout={onSheetLayout}
            style={[
              styles.sheet,
              { maxHeight: screenHeight * 0.85, paddingBottom: insets.bottom + spacing.lg },
              sheetStyle,
            ]}
            accessibilityViewIsModal
            {...pan.panHandlers}>
            <View onLayout={(e) => (headerHeight.current = e.nativeEvent.layout.height)}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <IconTile icon={roomIconOf(room)} size={52} tintKey={room.name} />
                <View style={{ flex: 1 }}>
                  <Text style={font.title} numberOfLines={1} accessibilityRole="header">
                    {room.name}
                  </Text>
                  <Text style={[font.small, { color: colors.textMuted }]}>{roomSummary(room)}</Text>
                </View>
              </View>
            </View>
            <ScrollView
              style={{ flexShrink: 1 }}
              // No bounce at the top: pulling down there moves the drawer
              bounces={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                listAtTop.current = e.nativeEvent.contentOffset.y <= 0;
              }}
              contentContainerStyle={styles.list}>
              {furniture.map((f) => (
                <ListRow
                  key={f.id}
                  inset={false}
                  title={f.name}
                  subtitle={f.item_count ? plural(f.item_count, 'objet') : 'Vide'}
                  icon={furnitureIconOf(f)}
                  tintKey={f.name}
                  chevron
                  onPress={() => dismiss(() => onOpenFurniture(f))}
                />
              ))}
              <AddTile label="Ajouter un rangement" onPress={() => dismiss(() => onAddFurniture(room))} />
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.edge,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg },
  // Room under each row for its thickness (shadow)
  list: { gap: spacing.md, paddingBottom: spacing.xs },
});
