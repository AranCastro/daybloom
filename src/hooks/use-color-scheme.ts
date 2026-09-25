/** The colour scheme in use: the one chosen in Settings, or the phone's when set to "System". */
import { useColorScheme as useSystemScheme } from 'react-native';

import { useAppState } from '@/lib/store';

export function useColorScheme(): 'light' | 'dark' {
  const choice = useAppState((s) => s.settings.appearance);
  const system = useSystemScheme();
  if (choice !== 'system') return choice;
  return system === 'dark' ? 'dark' : 'light';
}
