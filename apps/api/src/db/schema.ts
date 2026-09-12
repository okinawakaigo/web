import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { desc } from 'drizzle-orm';
import { roles, statuses } from '@okinawa-care/contracts';
import { eventNames } from '@okinawa-care/content/attribution';

// Maps the existing D1 tables. Schema changes still use the SQL migrations in migrations/.
export const consultations = sqliteTable('consultations', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role', { enum: roles }).notNull(),
  ageGroup: text('age_group').notNull().default(''),
  gender: text('gender').notNull().default(''),
  availability: text('availability').notNull().default(''),
  questions: text('questions').notNull().default(''),
  source: text('source').notNull(),
  medium: text('medium').notNull(),
  status: text('status', { enum: statuses }).notNull().default('未対応'),
  note: text('note').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  notification: text('notification', { enum: ['pending', 'sent', 'failed', 'unconfigured'] }).notNull().default('pending'),
  notificationStartedAt: text('notification_started_at'),
  notificationPayload: text('notification_payload'),
  notificationId: text('notification_id'),
}, table => [
  index('consultations_created').on(desc(table.createdAt), desc(table.id)),
  index('consultations_status_created').on(table.status, desc(table.createdAt), desc(table.id)),
]);

export const dailyEvents = sqliteTable('daily_events', {
  day: text('day').notNull(),
  source: text('source').notNull(),
  medium: text('medium').notNull(),
  event: text('event', { enum: eventNames }).notNull(),
  count: integer('count').notNull().default(0),
}, table => [primaryKey({ columns: [table.day, table.source, table.medium, table.event] })]);
