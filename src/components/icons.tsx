/** Hand-drawn line icons (24px grid, 1.8 stroke) so the app has its own visual voice. */
import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'sun'
  | 'people'
  | 'calendar'
  | 'settings'
  | 'send'
  | 'share'
  | 'check'
  | 'bell'
  | 'lock'
  | 'phone'
  | 'heart'
  | 'arrow'
  | 'back'
  | 'spark'
  | 'shield'
  | 'grid'
  | 'plus'
  | 'trash'
  | 'flag'
  | 'chat'
  | 'play'
  | 'close'
  | 'refresh'
  | 'star'
  | 'leaf'
  | 'moon'
  | 'clock';

type Props = { name: IconName; size?: number; color: string; strokeWidth?: number; fill?: string };

export function Icon({ name, size = 22, color, strokeWidth = 1.8, fill = 'none' }: Props) {
  const p = { stroke: color, strokeWidth, fill, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={4.2} {...p} />
          <Path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" {...p} />
        </>
      )}
      {name === 'people' && (
        <>
          <Circle cx={9} cy={8.5} r={3.3} {...p} />
          <Path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" {...p} />
          <Path d="M15.5 5.6a3.1 3.1 0 010 5.8M17.5 14.8c1.8.6 3 2.2 3.4 4.7" {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v11.5A1.5 1.5 0 0119 20H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" {...p} />
          <Path d="M3.5 10h17M8 3.5v4M16 3.5v4" {...p} />
          <Circle cx={8.5} cy={14.5} r={0.6} {...p} />
          <Circle cx={12} cy={14.5} r={0.6} {...p} />
          <Circle cx={15.5} cy={14.5} r={0.6} {...p} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" {...p} />
          <Circle cx={15} cy={7} r={2.2} {...p} />
          <Circle cx={9} cy={17} r={2.2} {...p} />
        </>
      )}
      {name === 'send' && <Path d="M20.5 3.5L10 14M20.5 3.5L14 20.5l-4-6.5-6.5-4 17-6.5z" {...p} />}
      {name === 'share' && (
        <>
          <Path d="M12 3.5v11M8 7.5l4-4 4 4" {...p} />
          <Path d="M6 11H5.5A1.5 1.5 0 004 12.5v6A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5v-6a1.5 1.5 0 00-1.5-1.5H18" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'bell' && (
        <>
          <Path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 1.5h-15L6 16.5z" {...p} />
          <Path d="M10 20.5a2.2 2.2 0 004 0" {...p} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Path d="M6.5 10.5h11a1.5 1.5 0 011.5 1.5v6.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18.5V12a1.5 1.5 0 011.5-1.5z" {...p} />
          <Path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" {...p} />
        </>
      )}
      {name === 'phone' && (
        <Path d="M6.6 3.5h2.3l1.4 4-2 1.3a11 11 0 006.9 6.9l1.3-2 4 1.4v2.3a2 2 0 01-2.1 2A16.5 16.5 0 014.6 5.6a2 2 0 012-2.1z" {...p} />
      )}
      {name === 'heart' && (
        <Path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0112 7a4.2 4.2 0 017.5 2.5c0 5.6-7.5 10-7.5 10z" {...p} />
      )}
      {name === 'arrow' && <Path d="M5 12h14M13.5 6.5L19 12l-5.5 5.5" {...p} />}
      {name === 'back' && <Path d="M19 12H5M10.5 6.5L5 12l5.5 5.5" {...p} />}
      {name === 'spark' && (
        <Path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8L12 3.5zM18.5 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" {...p} />
      )}
      {name === 'grid' && (
        <>
          <Path d="M5 4h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zM14 4h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1V5a1 1 0 011-1z" {...p} />
          <Path d="M5 13h5a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5a1 1 0 011-1zM14 13h5a1 1 0 011 1v5a1 1 0 01-1 1h-5a1 1 0 01-1-1v-5a1 1 0 011-1z" {...p} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === 'trash' && (
        <Path d="M4.5 7h15M9.5 7V5a1 1 0 011-1h3a1 1 0 011 1v2M6.5 7l.9 11.2A2 2 0 009.4 20h5.2a2 2 0 002-1.8L17.5 7M10 11v5M14 11v5" {...p} />
      )}
      {name === 'play' && (
        <>
          <Path d="M7.5 7.5h9a4.5 4.5 0 014.4 5.5l-.8 3.6a2.3 2.3 0 01-4 .9L14.3 15.5H9.7l-1.8 2a2.3 2.3 0 01-4-.9L3.1 13a4.5 4.5 0 014.4-5.5z" {...p} />
          <Path d="M8 10.2v3M6.5 11.7h3" {...p} />
          <Circle cx={15.8} cy={10.9} r={0.5} {...p} />
          <Circle cx={17.4} cy={12.6} r={0.5} {...p} />
        </>
      )}
      {name === 'star' && (
        <Path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6z" {...p} />
      )}
      {name === 'leaf' && (
        <>
          <Path d="M5 19c0-8 5.5-13.5 14-14 .2 8.8-5.5 14-14 14z" {...p} />
          <Path d="M5 19l8-8" {...p} />
        </>
      )}
      {name === 'moon' && <Path d="M19.5 14.5A8 8 0 019.5 4.5a7.5 7.5 0 1010 10z" {...p} />}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M12 7.5V12l3 2" {...p} />
        </>
      )}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === 'refresh' && <Path d="M19.5 12a7.5 7.5 0 11-2.2-5.3M19.5 4.5v4h-4" {...p} />}
      {name === 'chat' && (
        <Path d="M5 5.5h14A1.5 1.5 0 0120.5 7v8.5A1.5 1.5 0 0119 17h-7.5L7 20.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z" {...p} />
      )}
      {name === 'flag' && <Path d="M5.5 20.5V4.5M5.5 4.5h11l-2.5 4 2.5 4h-11" {...p} />}
      {name === 'shield' && (
        <>
          <Path d="M12 3.5l7 2.8v5.4c0 4.3-3 7.6-7 8.8-4-1.2-7-4.5-7-8.8V6.3l7-2.8z" {...p} />
          <Path d="M9 12l2.2 2.2L15.5 10" {...p} />
        </>
      )}
    </Svg>
  );
}
