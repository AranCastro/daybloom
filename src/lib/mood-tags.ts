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

/** Ids of the user's own moods start with this, so they never clash with the built-in ones. */
export const CUSTOM_PREFIX = 'my-';
export const MAX_CUSTOM_MOODS = 30;
const WORD_MAX = 16;

/** One word, letters only (any script), first letter capital: "  so tired " → "So". */
export function cleanMoodWord(input: string): string {
  const word = input.trim().split(/\s+/)[0] ?? '';
  const letters = word.replace(/[^\p{L}\p{M}'-]/gu, '').slice(0, WORD_MAX);
  return letters ? letters[0].toUpperCase() + letters.slice(1) : '';
}

/** A built-in feeling, or one of the user's own when their list is given. */
export function tagOf(id: string, custom: readonly MoodTag[] = []): MoodTag | undefined {
  return MOOD_TAGS.find((t) => t.id === id) ?? custom.find((t) => t.id === id);
}

/** The most used tags over a set of days, most frequent first. */
export function topTags(moodTags: Record<string, string[]>, days: string[], limit = 3, custom: readonly MoodTag[] = []): { tag: MoodTag; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of days) for (const id of moodTags[d] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => ({ tag: tagOf(id, custom), count }))
    .filter((x): x is { tag: MoodTag; count: number } => !!x.tag)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
