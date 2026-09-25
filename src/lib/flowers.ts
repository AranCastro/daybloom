/** Flowers grown by finished focus sessions. Drawn in code (components/flower.tsx). */

export type Rarity = 'common' | 'rare' | 'legendary';

export type FlowerKind = {
  id: string;
  name: string;
  rarity: Rarity;
  petals: number;
  shape: 'round' | 'pointed' | 'thin';
  petal: string;
  petalInner: string;
  center: string;
  line: string;
};

export const FLOWERS: readonly FlowerKind[] = [
  { id: 'marigold', name: 'Marigold', rarity: 'common', petals: 14, shape: 'round', petal: '#F29A2E', petalInner: '#F7C14B', center: '#C4631B', line: 'Bright and hardy, like a finished task.' },
  { id: 'jasmine', name: 'Jasmine', rarity: 'common', petals: 5, shape: 'pointed', petal: '#FFFFFF', petalInner: '#F4F1E6', center: '#E9D98B', line: 'Small, fragrant, quietly done.' },
  { id: 'hibiscus', name: 'Hibiscus', rarity: 'common', petals: 5, shape: 'round', petal: '#E0474C', petalInner: '#F07C6E', center: '#FBD34D', line: 'Bold focus, bold bloom.' },
  { id: 'daisy', name: 'Daisy', rarity: 'common', petals: 12, shape: 'thin', petal: '#FFFFFF', petalInner: '#F1F1F1', center: '#F2B84B', line: 'Simple. Steady. Yours.' },
  { id: 'sunflower', name: 'Sunflower', rarity: 'common', petals: 16, shape: 'pointed', petal: '#F5C12E', petalInner: '#F9D65E', center: '#6B4423', line: 'Turned towards the work, all session long.' },
  { id: 'periwinkle', name: 'Periwinkle', rarity: 'common', petals: 5, shape: 'round', petal: '#E77FB1', petalInner: '#F3A9CC', center: '#FFFFFF', line: 'Grows almost anywhere, like good habits.' },
  { id: 'tulip', name: 'Tulip', rarity: 'common', petals: 6, shape: 'pointed', petal: '#E96A8A', petalInner: '#F29BB0', center: '#F7D36B', line: 'Neat lines, clean finish.' },
  { id: 'lotus', name: 'Lotus', rarity: 'rare', petals: 8, shape: 'pointed', petal: '#F29CB8', petalInner: '#FAD0DD', center: '#F2C94C', line: 'Rare find: clear focus, rising above the noise.' },
  { id: 'neelakurinji', name: 'Neelakurinji', rarity: 'rare', petals: 10, shape: 'round', petal: '#7E6FD0', petalInner: '#A99CEB', center: '#EDE7FF', line: 'Rare find: the Western Ghats bloom that comes about once in twelve years.' },
  { id: 'parijat', name: 'Night Jasmine', rarity: 'rare', petals: 6, shape: 'thin', petal: '#FFFFFF', petalInner: '#FFF6E8', center: '#F28C28', line: 'Rare find: white petals, a coral heart.' },
  { id: 'orchid', name: 'Blue Orchid', rarity: 'rare', petals: 5, shape: 'round', petal: '#5B8DEF', petalInner: '#93B4F5', center: '#FFFFFF', line: 'Rare find: patience, in bloom.' },
  { id: 'golden-lotus', name: 'Golden Lotus', rarity: 'legendary', petals: 12, shape: 'pointed', petal: '#E8A317', petalInner: '#FFE08A', center: '#FFF4C2', line: 'Every tenth session: a golden bloom for steady work.' },
];

export function flowerOf(id: string): FlowerKind {
  return FLOWERS.find((f) => f.id === id) ?? FLOWERS[0];
}

/**
 * Picks the flower for session number `n` (1-based).
 * Every 10th is the Golden Lotus; otherwise 15% rare, else common,
 * avoiding the flower grown last time.
 */
export function pickFlower(n: number, lastId?: string, rand: () => number = Math.random): FlowerKind {
  if (n > 0 && n % 10 === 0) return flowerOf('golden-lotus');
  const pool = FLOWERS.filter((f) => f.rarity === (rand() < 0.15 ? 'rare' : 'common') && f.id !== lastId);
  return pool[Math.floor(rand() * pool.length)];
}

export const RARITY_LABEL: Record<Rarity, string> = { common: 'Common', rare: 'Rare', legendary: 'Legendary' };
