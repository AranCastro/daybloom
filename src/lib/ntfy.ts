/**
 * Delivery channel for nudges: ntfy.sh, a free, open-source publish/subscribe
 * notification service (https://ntfy.sh). The buddy subscribes to a random,
 * unguessable topic in the ntfy app; this app publishes one short line to it.
 * No account and no server of our own are needed.
 */
import * as Crypto from 'expo-crypto';

export const NTFY_BASE = 'https://ntfy.sh';
export const JOIN_PAGE = 'https://arancastro.github.io/join/';

export function newTopic(): string {
  const bytes = Crypto.getRandomBytes(12);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (const b of bytes) id += alphabet[b % alphabet.length];
  return `nudge-${id}`;
}

export function ackTopic(topic: string): string {
  return `${topic}-ack`;
}

export function inviteLink(topic: string, name: string): string {
  return `${JOIN_PAGE}?t=${encodeURIComponent(topic)}&n=${encodeURIComponent(name)}`;
}

export function subscribeLink(topic: string): string {
  return `${NTFY_BASE}/${topic}`;
}

type Publish = { topic: string; title: string; message: string; tags?: string[]; priority?: 1 | 2 | 3 | 4 | 5 };

async function publish(body: Publish): Promise<boolean> {
  try {
    const res = await fetch(NTFY_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** The real nudge. It deliberately says nothing about mood. */
export function sendNudge(topic: string, name: string): Promise<boolean> {
  return publish({
    topic,
    title: `Call ${name} today`,
    message: `${name} would be glad to hear from you today. No need to mention this note — just say hello.`,
    tags: ['yellow_heart'],
    priority: 4,
  });
}

export function sendTest(topic: string, name: string): Promise<boolean> {
  return publish({
    topic,
    title: 'Daybloom — test',
    message: `You're set up as ${name}'s buddy. If a nudge ever arrives, a call or a message is all it asks.`,
    tags: ['wave'],
    priority: 3,
  });
}

/** Has the buddy tapped "I'm in" on the join page? ntfy.sh keeps messages for about 12 hours. */
export async function buddyHasJoined(topic: string): Promise<boolean> {
  try {
    const res = await fetch(`${NTFY_BASE}/${ackTopic(topic)}/json?poll=1&since=all`);
    if (!res.ok) return false;
    const text = await res.text();
    return text.split('\n').some((line) => line.includes('"event":"message"'));
  } catch {
    return false;
  }
}
