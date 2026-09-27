/**
 * Optional feeling tags for the daily check-in: twenty everyday words in Indian English.
 * The one-tap mood stays the check-in; tags only add detail when the user wants to.
 */
export type MoodTag = { id: string; label: string; emoji: string; tone: 'light' | 'heavy' };

export const MOOD_TAGS: readonly MoodTag[] = [
  { id: 'happy', label: 'Happy', emoji: '😊', tone: 'light' },
  { id: 'peaceful', label: 'Peaceful', emoji: '😌', tone: 'light' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏', tone: 'light' },
  { id: 'blessed', label: 'Blessed', emoji: '😇', tone: 'light' },
  { id: 'excited', label: 'Excited', emoji: '🤩', tone: 'light' },
  { id: 'proud', label: 'Proud', emoji: '🏅', tone: 'light' },
  { id: 'loved', label: 'Loved', emoji: '🥰', tone: 'light' },
  { id: 'fresh', label: 'Fresh', emoji: '🌿', tone: 'light' },
  { id: 'hopeful', label: 'Hopeful', emoji: '🌅', tone: 'light' },
  { id: 'relaxed', label: 'Relaxed', emoji: '☕', tone: 'light' },
  { id: 'tension', label: 'Tension', emoji: '😬', tone: 'heavy' },
  { id: 'worried', label: 'Worried', emoji: '😟', tone: 'heavy' },
  { id: 'overthinking', label: 'Overthinking', emoji: '🌀', tone: 'heavy' },
  { id: 'irritated', label: 'Irritated', emoji: '😤', tone: 'heavy' },
  { id: 'frustrated', label: 'Frustrated', emoji: '😣', tone: 'heavy' },
  { id: 'sad', label: 'Sad', emoji: '😢', tone: 'heavy' },
  { id: 'lonely', label: 'Lonely', emoji: '😔', tone: 'heavy' },
  { id: 'homesick', label: 'Homesick', emoji: '🏡', tone: 'heavy' },
  { id: 'bored', label: 'Bored', emoji: '😑', tone: 'heavy' },
  { id: 'tired', label: 'Tired', emoji: '😴', tone: 'heavy' },
];

/** Up to five tags a day keeps the choice quick. */
export const MAX_TAGS_PER_DAY = 5;

export function tagOf(id: string): MoodTag | undefined {
  return MOOD_TAGS.find((t) => t.id === id);
}

/** The most used tags over a set of days, most frequent first. */
export function topTags(moodTags: Record<string, string[]>, days: string[], limit = 3): { tag: MoodTag; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of days) for (const id of moodTags[d] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ tag: tagOf(id), count }))
    .filter((x): x is { tag: MoodTag; count: number } => !!x.tag)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
