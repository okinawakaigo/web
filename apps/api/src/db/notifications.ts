import { and, eq, ne, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { consultations } from './schema';

export function notificationRepository(binding: D1Database) {
  const db = drizzle(binding);
  return {
    find: (id: string) => db.select({
      status: consultations.notification,
      startedAt: consultations.notificationStartedAt,
      payload: consultations.notificationPayload,
    }).from(consultations).where(eq(consultations.id, id)).get(),

    async prepareDelivery(id: string, startedAt: string, payload: string) {
      // Preserve the first timestamp and payload atomically across concurrent retries.
      await db.update(consultations).set({
        notificationStartedAt: sql`coalesce(${consultations.notificationStartedAt}, ${startedAt})`,
        notificationPayload: sql`coalesce(${consultations.notificationPayload}, ${payload})`,
      }).where(eq(consultations.id, id)).run();
      return db.select({
        startedAt: consultations.notificationStartedAt, payload: consultations.notificationPayload,
      }).from(consultations).where(eq(consultations.id, id)).get();
    },

    markUnsent: (id: string, status: 'failed' | 'unconfigured') => db.update(consultations)
      .set({ notification: status })
      .where(and(eq(consultations.id, id), ne(consultations.notification, 'sent'))).run(),

    markSent: (id: string, messageId: string) => db.update(consultations)
      .set({ notification: 'sent', notificationId: messageId }).where(eq(consultations.id, id)).run(),
  };
}
