import { Redirect, useLocalSearchParams } from 'expo-router';

import { BreatheGame } from '@/components/games/breathe';
import { BubblesGame } from '@/components/games/bubbles';
import { ColoursGame } from '@/components/games/colours';
import { MemoryGame } from '@/components/games/memory';

export default function GameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  switch (id) {
    case 'breathe':
      return <BreatheGame />;
    case 'bubbles':
      return <BubblesGame />;
    case 'memory':
      return <MemoryGame />;
    case 'colours':
      return <ColoursGame />;
    default:
      return <Redirect href="/play" />;
  }
}
