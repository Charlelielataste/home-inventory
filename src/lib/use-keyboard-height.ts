import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Height covered by the on-screen keyboard from the bottom edge of the screen (0 when hidden).
 *
 * Used instead of KeyboardAvoidingView for screens whose bottom edge is the
 * screen's bottom edge (iOS page sheet modal, Android edge-to-edge): the
 * keyboard then covers exactly its own height, no offset to guess.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  // Android reports the keyboard height minus the navigation bar under it: the footer
  // stayed hidden behind the keyboard by that much (iOS: the full height)
  const { bottom } = useSafeAreaInsets();
  const navigationBar = Platform.OS === 'android' ? bottom : 0;

  useEffect(() => {
    // iOS: "will" events to move along with the keyboard animation
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height > 0 ? height + navigationBar : 0;
}
