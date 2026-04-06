'use server';

import { getDb } from '@/db';
import { waitlistEntry } from '@/db/schema';
import { randomUUID } from 'node:crypto';
import { getLocale } from 'next-intl/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const waitlistSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address' }),
});

export async function subscribeWaitlistAction(input: { email: string }) {
  const parsed = waitlistSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message || 'Please enter a valid email address',
    };
  }

  try {
    const db = await getDb();
    const locale = await getLocale();
    const normalizedEmail = parsed.data.email.trim().toLowerCase();

    const existing = await db
      .select({ id: waitlistEntry.id })
      .from(waitlistEntry)
      .where(eq(waitlistEntry.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: true,
      };
    }

    const now = new Date();

    await db.insert(waitlistEntry).values({
      id: randomUUID(),
      email: normalizedEmail,
      source: 'website',
      locale,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error('[ownlab-www] waitlist subscribe failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Something went wrong',
    };
  }
}
