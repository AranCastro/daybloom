/** Draws a Focus Garden flower from its recipe (petal count, shape, colours). */
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { FlowerKind } from '@/lib/flowers';

export function Flower({ kind, size = 64, stem = false }: { kind: FlowerKind; size?: number; stem?: boolean }) {
  const c = 50; // head centre in a 100 × 100 box (stemmed flowers shift up)
  const cy = stem ? 38 : 50;
  const n = kind.petals;
  const len = kind.shape === 'thin' ? 30 : n > 10 ? 28 : 30;
  const wid = kind.shape === 'thin' ? 5.5 : kind.shape === 'pointed' ? (n > 10 ? 7 : 10) : n > 10 ? 8 : 14;
  const petals = Array.from({ length: n }, (_, i) => (360 / n) * i);
  const inner = kind.rarity === 'legendary' || n <= 8;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {stem && (
        <G>
          <Path d={`M${c} ${cy + 10} C ${c - 2} 70, ${c + 2} 82, ${c} 98`} stroke="#5E9E6E" strokeWidth={4} fill="none" strokeLinecap="round" />
          <Path d={`M${c} 80 C ${c - 18} 74, ${c - 22} 64, ${c - 10} 62 C ${c - 6} 70, ${c - 3} 75, ${c} 80 Z`} fill="#86C17A" />
          <Path d={`M${c} 74 C ${c + 16} 68, ${c + 20} 58, ${c + 9} 57 C ${c + 5} 64, ${c + 3} 69, ${c} 74 Z`} fill="#6FAE7C" />
        </G>
      )}
      {kind.rarity === 'legendary' && <Circle cx={c} cy={cy} r={46} fill={kind.petalInner} opacity={0.35} />}
      <G>
        {petals.map((deg) =>
          kind.shape === 'pointed' ? (
            <Path
              key={deg}
              d={`M${c} ${cy} C ${c - wid} ${cy - len * 0.45}, ${c - wid * 0.6} ${cy - len * 0.9}, ${c} ${cy - len - 6} C ${c + wid * 0.6} ${cy - len * 0.9}, ${c + wid} ${cy - len * 0.45}, ${c} ${cy} Z`}
              fill={kind.petal}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.8}
              transform={`rotate(${deg} ${c} ${cy})`}
            />
          ) : (
            <Ellipse
              key={deg}
              cx={c}
              cy={cy - len * 0.62}
              rx={wid / 2}
              ry={len * 0.62}
              fill={kind.petal}
              stroke="rgba(0,0,0,0.08)"
              strokeWidth={0.8}
              transform={`rotate(${deg} ${c} ${cy})`}
            />
          ),
        )}
        {inner &&
          petals.map((deg) => (
            <Ellipse
              key={`i${deg}`}
              cx={c}
              cy={cy - len * 0.34}
              rx={wid / 3.2}
              ry={len * 0.3}
              fill={kind.petalInner}
              transform={`rotate(${deg + 180 / n} ${c} ${cy})`}
            />
          ))}
      </G>
      <Circle cx={c} cy={cy} r={n > 12 ? 13 : 9} fill={kind.center} />
      <Circle cx={c - 3} cy={cy - 3} r={3} fill="#FFFFFF" opacity={0.45} />
    </Svg>
  );
}

/** Closed green bud for a session in progress; `grow` (0..1) opens it a little. */
export function Bud({ size = 64, grow = 0 }: { size?: number; grow?: number }) {
  const open = 4 + grow * 10;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M50 98 C 49 84, 51 72, 50 58" stroke="#5E9E6E" strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M50 84 C 34 80, 30 70, 40 67 C 44 74, 47 78, 50 84 Z" fill="#86C17A" />
      <Path d={`M50 60 C ${50 - open} 52, ${50 - open} 38, 50 ${30 - grow * 6} C ${50 + open} 38, ${50 + open} 52, 50 60 Z`} fill="#6FAE7C" />
      <Path d={`M50 60 C ${50 - open * 0.5} 50, ${50 - open * 0.4} 40, 50 ${34 - grow * 6} C ${50 + open * 0.4} 40, ${50 + open * 0.5} 50, 50 60 Z`} fill="#F2A999" opacity={0.25 + grow * 0.6} />
    </Svg>
  );
}
