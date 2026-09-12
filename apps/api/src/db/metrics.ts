import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { Attribution, EventName } from '@okinawa-care/content/attribution';
import { dailyEvents } from './schema';

export async function incrementDailyEvent(binding: D1Database, day: string, attribution: Attribution, event: EventName) {
  await drizzle(binding).insert(dailyEvents).values({ day, ...attribution, event, count: 1 })
    .onConflictDoUpdate({
      target: [dailyEvents.day, dailyEvents.source, dailyEvents.medium, dailyEvents.event],
      set: { count: sql`${dailyEvents.count} + 1` },
    }).run();
}
