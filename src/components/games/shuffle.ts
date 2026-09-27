/**
 * Fisher–Yates shuffle: every order is equally likely. Sorting with a random comparator
 * (`sort(() => Math.random() - 0.5)`) is biased towards the original order.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
