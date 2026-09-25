/**
 * SVG strings for home-screen widgets. Widgets are drawn natively from plain SVG,
 * so these mirror the in-app drawings (components/flower.tsx, components/icons.tsx).
 */
import type { FlowerKind } from '@/lib/flowers';

const ICONS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  phone: 'M6.6 3.5h2.3l1.4 4-2 1.3a11 11 0 006.9 6.9l1.3-2 4 1.4v2.3a2 2 0 01-2.1 2A16.5 16.5 0 014.6 5.6a2 2 0 012-2.1z',
  chat: 'M5 5.5h14A1.5 1.5 0 0120.5 7v8.5A1.5 1.5 0 0119 17h-7.5L7 20.5V17H5a1.5 1.5 0 01-1.5-1.5V7A1.5 1.5 0 015 5.5z',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13.5 6.5L19 12l-5.5 5.5',
  flame: 'M12 21c-3.7 0-6.2-2.5-6.2-5.8 0-3.3 2.5-5.2 3.7-7.6.5 1.7 1.5 2.7 2.7 3.1.1-2.8 1.4-5.4 3.5-7.2.2 2.6 1.2 4 2.4 5.8 1 1.4 1.6 2.7 1.6 4.3C19.7 18.3 16.3 21 12 21z',
  clock: 'M12 3.5a8.5 8.5 0 110 17 8.5 8.5 0 010-17zM12 7.5V12l3 2',
} as const;

export type WidgetIcon = keyof typeof ICONS;

export function iconSvg(name: WidgetIcon, color: string, size = 24, fill = 'none'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${ICONS[name]}" fill="${fill}" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** A mood orb: soft gradient sphere, with a ring when it is today's mood. */
export function orbSvg(colors: readonly [string, string], size: number, ring?: string): string {
  const r = ring ? 40 : 46;
  // Unique ids: several orbs can share one page (the in-app preview on web).
  const id = colors[0].slice(1) + colors[1].slice(1);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">` +
    `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient>` +
    `<radialGradient id="h${id}" cx="0.35" cy="0.3" r="0.6"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>` +
    (ring ? `<circle cx="50" cy="50" r="47" fill="none" stroke="${ring}" stroke-width="4"/>` : '') +
    `<circle cx="50" cy="50" r="${r}" fill="url(#g${id})"/><circle cx="50" cy="50" r="${r}" fill="url(#h${id})"/></svg>`
  );
}

/** WhatsApp-style mark: a green round speech bubble with a white handset. */
export function whatsappSvg(size = 20): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
    `<path d="M12 2.5a9.5 9.5 0 00-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1012 2.5z" fill="#25D366"/>` +
    `<path d="M8.9 7.2c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.4.8 1 1.5 1.7 2 .5.4 1.1.7 1.6.9.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.4-.1 1.2-.6 1.6-.5.5-1.4.7-2.2.5-1.4-.4-2.7-1.2-3.8-2.3-1-1-1.8-2.2-2.1-3.5-.2-.8 0-1.6.5-2.1.3-.3.5-.4.7-.4z" fill="#FFFFFF"/></svg>`
  );
}

/** A tick circle for task rows. */
export function tickSvg(color: string, size = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="none" stroke="${color}" stroke-width="1.8"/></svg>`;
}

/** A filled tick circle for finished tasks. */
export function doneSvg(color: string, size = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="${color}"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** Draws a garden flower from its recipe, as components/flower.tsx does. */
export function flowerSvg(kind: FlowerKind, size: number, stem = false): string {
  const c = 50;
  const cy = stem ? 38 : 50;
  const n = kind.petals;
  const len = kind.shape === 'thin' ? 30 : n > 10 ? 28 : 30;
  const wid = kind.shape === 'thin' ? 5.5 : kind.shape === 'pointed' ? (n > 10 ? 7 : 10) : n > 10 ? 8 : 14;
  const angles = Array.from({ length: n }, (_, i) => (360 / n) * i);
  const inner = kind.rarity === 'legendary' || n <= 8;

  let body = '';
  if (stem) {
    body +=
      `<path d="M${c} ${cy + 10} C ${c - 2} 70, ${c + 2} 82, ${c} 98" stroke="#5E9E6E" stroke-width="4" fill="none" stroke-linecap="round"/>` +
      `<path d="M${c} 80 C ${c - 18} 74, ${c - 22} 64, ${c - 10} 62 C ${c - 6} 70, ${c - 3} 75, ${c} 80 Z" fill="#86C17A"/>` +
      `<path d="M${c} 74 C ${c + 16} 68, ${c + 20} 58, ${c + 9} 57 C ${c + 5} 64, ${c + 3} 69, ${c} 74 Z" fill="#6FAE7C"/>`;
  }
  if (kind.rarity === 'legendary') body += `<circle cx="${c}" cy="${cy}" r="46" fill="${kind.petalInner}" fill-opacity="0.35"/>`;
  for (const deg of angles) {
    const t = `transform="rotate(${deg} ${c} ${cy})"`;
    body +=
      kind.shape === 'pointed'
        ? `<path d="M${c} ${cy} C ${c - wid} ${cy - len * 0.45}, ${c - wid * 0.6} ${cy - len * 0.9}, ${c} ${cy - len - 6} C ${c + wid * 0.6} ${cy - len * 0.9}, ${c + wid} ${cy - len * 0.45}, ${c} ${cy} Z" fill="${kind.petal}" stroke="#000000" stroke-opacity="0.08" stroke-width="0.8" ${t}/>`
        : `<ellipse cx="${c}" cy="${cy - len * 0.62}" rx="${wid / 2}" ry="${len * 0.62}" fill="${kind.petal}" stroke="#000000" stroke-opacity="0.08" stroke-width="0.8" ${t}/>`;
  }
  if (inner) {
    for (const deg of angles) {
      body += `<ellipse cx="${c}" cy="${cy - len * 0.34}" rx="${wid / 3.2}" ry="${len * 0.3}" fill="${kind.petalInner}" transform="rotate(${deg + 180 / n} ${c} ${cy})"/>`;
    }
  }
  body += `<circle cx="${c}" cy="${cy}" r="${n > 12 ? 13 : 9}" fill="${kind.center}"/><circle cx="${c - 3}" cy="${cy - 3}" r="3" fill="#FFFFFF" fill-opacity="0.45"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${body}</svg>`;
}

/** A small green bud, for an empty garden. */
export function budSvg(size: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">` +
    `<path d="M50 98 C 49 84, 51 72, 50 58" stroke="#5E9E6E" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<path d="M50 84 C 34 80, 30 70, 40 67 C 44 74, 47 78, 50 84 Z" fill="#86C17A"/>` +
    `<path d="M50 60 C 46 52, 46 38, 50 30 C 54 38, 54 52, 50 60 Z" fill="#6FAE7C"/></svg>`
  );
}
