/**
 * Draws a Poo Kolam (floral carpet) from a Thottam design: a flower at the centre, rings of
 * petals outwards, and a festival border: Onam petals and leaves, Diwali diyas, or a Pongal kolam.
 */
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { flowerOf } from '@/lib/flowers';
import type { Pookalam } from '@/lib/store';

const BG = { onam: '#F6EAD2', diwali: '#1D1A38', pongal: '#8A4B2C' } as const;

export function PookalamArt({ design, size }: { design: Pick<Pookalam, 'center' | 'rings' | 'festival'>; size: number }) {
  const c = size / 2;
  const R = size * 0.39; // outer edge of the rings; the festival border sits outside it
  const r0 = size * 0.1; // centre flower
  const n = Math.max(1, design.rings.length);
  const w = (R - r0) / n;
  const centre = flowerOf(design.center);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect x={0} y={0} width={size} height={size} rx={size * 0.08} fill={BG[design.festival]} />
      {design.festival === 'diwali' && <Circle cx={c} cy={c} r={R * 1.25} fill="#F5B34233" />}
      <Circle cx={c} cy={c} r={R + 2} fill="#00000014" />

      {/* Rings, outermost first so inner ones sit on top. */}
      {[...design.rings].map((ring, i) => ({ ring, i })).reverse().map(({ ring, i }) => {
        const f = flowerOf(ring.flower);
        const mid = r0 + w * (i + 0.5);
        const circ = 2 * Math.PI * mid;
        const count = 12 + i * 6;
        return (
          <G key={i}>
            {ring.pattern === 'solid' && <Circle cx={c} cy={c} r={mid} stroke={f.petal} strokeWidth={w + 0.5} fill="none" />}
            {ring.pattern === 'alternate' && (
              <>
                <Circle cx={c} cy={c} r={mid} stroke={f.petalInner} strokeWidth={w + 0.5} fill="none" />
                <Circle cx={c} cy={c} r={mid} stroke={f.petal} strokeWidth={w + 0.5} fill="none" strokeDasharray={`${circ / 32} ${circ / 32}`} />
              </>
            )}
            {ring.pattern === 'petals' && (
              <>
                <Circle cx={c} cy={c} r={mid} stroke={f.petalInner} strokeWidth={w + 0.5} fill="none" />
                {Array.from({ length: count }, (_, k) => {
                  const a = (360 / count) * k;
                  return <Ellipse key={k} cx={c} cy={c - mid} rx={Math.min(w * 0.3, circ / count / 2.4)} ry={w * 0.46} fill={f.petal} transform={`rotate(${a} ${c} ${c})`} />;
                })}
              </>
            )}
            {ring.pattern === 'dots' && (
              <>
                <Circle cx={c} cy={c} r={mid} stroke={f.petal} strokeWidth={w + 0.5} fill="none" />
                {Array.from({ length: count }, (_, k) => {
                  const a = ((2 * Math.PI) / count) * k;
                  return <Circle key={k} cx={c + mid * Math.cos(a)} cy={c + mid * Math.sin(a)} r={Math.min(w * 0.22, 5)} fill={f.center} />;
                })}
              </>
            )}
          </G>
        );
      })}

      {/* Centre flower. */}
      {Array.from({ length: 8 }, (_, k) => (
        <Ellipse key={k} cx={c} cy={c - r0 * 0.55} rx={r0 * 0.28} ry={r0 * 0.5} fill={centre.petal} transform={`rotate(${k * 45} ${c} ${c})`} />
      ))}
      <Circle cx={c} cy={c} r={r0 * 0.42} fill={centre.petalInner} />
      <Circle cx={c} cy={c} r={r0 * 0.22} fill={centre.center} />

      <Border festival={design.festival} c={c} R={R} size={size} accent={flowerOf(design.rings[n - 1]?.flower ?? design.center).petal} />
    </Svg>
  );
}

function Border({ festival, c, R, size, accent }: { festival: Pookalam['festival']; c: number; R: number; size: number; accent: string }) {
  if (festival === 'onam') {
    // Pointed petals alternating with green leaves.
    const count = 24;
    return (
      <G>
        {Array.from({ length: count }, (_, k) => {
          const a = (360 / count) * k;
          const leaf = k % 2 === 1;
          const h = size * (leaf ? 0.055 : 0.07);
          return (
            <Path
              key={k}
              d={`M${c} ${c - R - 1} q ${size * 0.02} ${-h * 0.6} 0 ${-h} q ${-size * 0.02} ${h * 0.4} 0 ${h} z`}
              fill={leaf ? '#4E9A4A' : accent}
              transform={`rotate(${a} ${c} ${c})`}
            />
          );
        })}
      </G>
    );
  }
  if (festival === 'diwali') {
    // Twelve diyas: clay lamps with a flame.
    const count = 12;
    const rr = R + size * 0.055;
    return (
      <G>
        {Array.from({ length: count }, (_, k) => {
          const a = ((2 * Math.PI) / count) * k - Math.PI / 2;
          const x = c + rr * Math.cos(a);
          const y = c + rr * Math.sin(a);
          const s = size * 0.028;
          return (
            <G key={k}>
              <Circle cx={x} cy={y - s * 0.9} r={s * 1.4} fill="#F5B34240" />
              <Path d={`M${x - s * 1.2} ${y} q ${s * 1.2} ${s * 1.5} ${s * 2.4} 0 z`} fill="#B5562B" />
              <Path d={`M${x} ${y - s * 1.8} q ${s * 0.6} ${s * 0.9} 0 ${s * 1.6} q ${-s * 0.6} ${-s * 0.7} 0 ${-s * 1.6} z`} fill="#FFC23A" />
              <Circle cx={x} cy={y - s * 0.55} r={s * 0.25} fill="#FFF3C4" />
            </G>
          );
        })}
      </G>
    );
  }
  // Pongal: a kolam of rice-flour dots with loops around them.
  const count = 16;
  const rr = R + size * 0.055;
  return (
    <G>
      <Circle cx={c} cy={c} r={rr} stroke="#FFF8EC" strokeWidth={1.5} fill="none" strokeDasharray="2 5" />
      {Array.from({ length: count }, (_, k) => {
        const a = ((2 * Math.PI) / count) * k;
        const x = c + rr * Math.cos(a);
        const y = c + rr * Math.sin(a);
        return (
          <G key={k}>
            <Circle cx={x} cy={y} r={size * 0.026} stroke="#FFF8EC" strokeWidth={1.6} fill="none" />
            <Circle cx={x} cy={y} r={size * 0.007} fill="#FFF8EC" />
          </G>
        );
      })}
      {[0, 1, 2, 3].map((k) => {
        const x = k % 2 ? size - size * 0.07 : size * 0.07;
        const y = k > 1 ? size - size * 0.07 : size * 0.07;
        return <Circle key={k} cx={x} cy={y} r={size * 0.02} stroke="#FFF8EC" strokeWidth={1.4} fill="none" />;
      })}
    </G>
  );
}
