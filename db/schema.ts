import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const achievements = sqliteTable(
  "achievements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    achievedOn: text("achieved_on").notNull(),
    startedOn: text("started_on"),
    finishedOn: text("finished_on"),
    category: text("category").notNull(),
    customCategory: text("custom_category"),
    tagsJson: text("tags_json").notNull().default("[]"),
    importance: text("importance").notNull().default("normal"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_achievements_user_date").on(table.userId, table.achievedOn),
    index("idx_achievements_user_category").on(table.userId, table.category),
  ],
);
