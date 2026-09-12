import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { statuses, type Consultation, type ConsultationList, type Status } from '@okinawa-care/contracts';
import { submittedFields } from './intake';
import { consultations } from './schema';

// Explicit projections keep mail payloads out of the API, and contact details out of lists.
const summaryFields = {
  id: consultations.id, createdAt: consultations.createdAt, name: consultations.name,
  role: consultations.role, status: consultations.status, notification: consultations.notification,
};
const detailFields = {
  ...submittedFields, createdAt: consultations.createdAt, status: consultations.status,
  notification: consultations.notification, note: consultations.note, revision: consultations.revision,
};
const pageSize = 50;
function containsText(column: SQLiteColumn, value: string) {
  const pattern = `%${value.replace(/[\\%_]/g, '\\$&')}%`;
  return sql`${column} LIKE ${pattern} ESCAPE ${'\\'}`;
}

/** Admin-only listing, detail and updates. ESLint keeps this module out of the recruit Worker. */
export function consultationRepository(binding: D1Database) {
  const db = drizzle(binding);
  return {
    find: (id: string): Promise<Consultation | undefined> => db.select(detailFields)
      .from(consultations).where(eq(consultations.id, id)).get(),

    async exists(id: string) {
      return !!await db.select({ id: consultations.id }).from(consultations).where(eq(consultations.id, id)).get();
    },

    async list({ status, offset, query }: { status: Status | ''; offset: number; query: string }): Promise<ConsultationList> {
      const filter = and(
        status ? eq(consultations.status, status) : undefined,
        query ? or(containsText(consultations.name, query), containsText(consultations.role, query)) : undefined,
      );
      const [items, total, grouped] = await Promise.all([
        db.select(summaryFields).from(consultations).where(filter)
          .orderBy(desc(consultations.createdAt), desc(consultations.id)).limit(pageSize + 1).offset(offset).all(),
        db.select({ count: count() }).from(consultations).where(filter).get(),
        db.select({ status: consultations.status, count: count() }).from(consultations).groupBy(consultations.status).all(),
      ]);
      const counts = Object.fromEntries(statuses.map(value => [value, 0])) as Record<Status, number>;
      for (const row of grouped) counts[row.status] = row.count;
      return { items: items.slice(0, pageSize), hasMore: items.length > pageSize, total: total?.count ?? 0, counts };
    },

    async update(id: string, changes: Pick<Consultation, 'status' | 'note' | 'revision'>) {
      const result = await db.update(consultations).set({
        status: changes.status, note: changes.note, revision: sql`${consultations.revision} + 1`,
      }).where(and(eq(consultations.id, id), eq(consultations.revision, changes.revision))).run();
      return result.meta.changes === 1;
    },
  };
}
