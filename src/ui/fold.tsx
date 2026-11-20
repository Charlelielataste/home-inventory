import { useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { IconButton } from './buttons';
import { Icon } from './icon';
import { colors } from './theme';

/**
 * Soft spring, damped enough to settle without visible bounce (the user found the
 * overshoot too much). Respects the system "reduce motion" setting.
 */
const FOLD_SPRING = { damping: 26, stiffness: 170, mass: 1 };

type FoldOptions = {
  /** Unfolded now: `open` springs to it on change */
  expanded: boolean;
  /** Value of `open` at mount (default: 0, folded) */
  initial?: 0 | 1;
  /** Scale of the quick press played by `press()` (barely noticeable, no rebound) */
  squashScale: number;
  /** Duration of the glide when the body's measured height changes */
  glideMs: number;
  /** Selection mode: plain selected background instead of the folding colors */
  selected?: boolean;
};

/**
 * Folding shared by the rooms of the home screen and the item cards. Everything is driven
 * by one Reanimated value `open` (0 folded → 1 unfolded):
 * - `containerStyle`: light card (surface) folded → tinted panel unfolded, + the press squash;
 * - `bodyStyle`: height of the clip of the body (measured height × open), to put on a view
 *   with `overflow: 'hidden'`; the body inside measures itself with `onBodyLayout`;
 * - `press()`: plays the squash, to call on each toggle.
 */
export function useFold({ expanded, initial = 0, squashScale, glideMs, selected }: FoldOptions) {
  const open = useSharedValue<number>(initial);
  const bodyHeight = useSharedValue(0);
  const squash = useSharedValue(1);

  useEffect(() => {
    open.set(withSpring(expanded ? 1 : 0, FOLD_SPRING));
  }, [expanded, open]);

  const press = () => {
    squash.set(withSequence(withTiming(squashScale, { duration: 80 }), withTiming(1, { duration: 180 })));
  };

  const onBodyLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // First measure: no animation; later (content changed): glide to the new height
    bodyHeight.set(bodyHeight.get() === 0 ? h : withTiming(h, { duration: glideMs }));
  };

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: selected
      ? colors.selected
      : interpolateColor(Math.min(Math.max(open.get(), 0), 1), [0, 1], [colors.surface, colors.panel]),
    transform: [{ scale: squash.get() }],
  }));
  const bodyStyle = useAnimatedStyle(() =>
    // Not measured yet while unfolded: natural height (avoids an empty first frame)
    bodyHeight.get() === 0 && open.get() === 1 ? {} : { height: Math.max(0, bodyHeight.get() * open.get()) },
  );

  return { open, press, onBodyLayout, containerStyle, bodyStyle };
}

/**
 * Chevron key of a foldable header: turns a quarter while unfolding. Light key on the
 * tinted panel (unfolded), cream key on the light card (folded). Plays no feedback: the
 * toggle plays `open` / `close`.
 */
export function FoldChevron({
  open,
  expanded,
  name,
  onPress,
}: {
  open: SharedValue<number>;
  expanded: boolean;
  /** Name of what folds, read by screen readers ("Replier Cuisine") */
  name: string;
  onPress: () => void;
}) {
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${90 * open.get()}deg` }] }));
  return (
    <IconButton
      icon="chevron-forward"
      variant={expanded ? 'light' : 'soft'}
      label={expanded ? `Replier ${name}` : `Déplier ${name}`}
      accessibilityState={{ expanded }}
      feedback={false}
      onPress={onPress}>
      <Animated.View style={chevronStyle}>
        <Icon name="chevron-forward" size={16} color={colors.text} />
      </Animated.View>
    </IconButton>
  );
}
