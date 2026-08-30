import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const workspaceStatusValues = ['active', 'suspended', 'archived'] as const;
export type WorkspaceStatus = (typeof workspaceStatusValues)[number];

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique('workspaces_slug_unique'),
    displayName: text('display_name').notNull(),
    status: text('status').$type<WorkspaceStatus>().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check('workspaces_slug_format_check', sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
    check(
      'workspaces_status_check',
      sql`${table.status} in ('active', 'suspended', 'archived')`,
    ),
  ],
);

export const workspacePreferences = pgTable('workspace_preferences', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
