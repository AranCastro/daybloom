/** Ask before something that cannot be undone. Alert buttons do not work on web, so the demo uses confirm(). */
import { Alert, Platform } from 'react-native';

export function confirmThen(title: string, message: string, action: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onYes },
  ]);
}
