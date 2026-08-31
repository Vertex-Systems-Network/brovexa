CREATE TABLE "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
  CONSTRAINT "workspaces_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT "workspaces_status_check" CHECK ("status" in ('active', 'suspended', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "workspace_preferences" (
  "workspace_id" uuid PRIMARY KEY NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "locale" text DEFAULT 'en' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "workspace_preferences_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade
);
