CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_status_check CHECK (
    status IN (
      'pending_verification',
      'active',
      'locked_security',
      'suspended_admin',
      'deletion_pending',
      'deleted_or_anonymized'
    )
  )
);
--> statement-breakpoint
CREATE TABLE workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_memberships_status_check CHECK (
    status IN ('active', 'suspended', 'removed')
  ),
  CONSTRAINT workspace_memberships_workspace_user_unique UNIQUE (workspace_id, user_id),
  CONSTRAINT workspace_memberships_id_workspace_unique UNIQUE (id, workspace_id)
);
--> statement-breakpoint
CREATE INDEX workspace_memberships_user_idx
  ON workspace_memberships (user_id, workspace_id);
--> statement-breakpoint
CREATE TABLE permissions (
  key text PRIMARY KEY,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permissions_key_check CHECK (key ~ '^[a-z][a-z0-9_.-]*$')
);
--> statement-breakpoint
CREATE TABLE workspace_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key text NOT NULL,
  display_name text NOT NULL,
  kind text NOT NULL DEFAULT 'custom',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_roles_key_check CHECK (key ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT workspace_roles_kind_check CHECK (kind IN ('owner', 'custom')),
  CONSTRAINT workspace_roles_workspace_key_unique UNIQUE (workspace_id, key),
  CONSTRAINT workspace_roles_id_workspace_unique UNIQUE (id, workspace_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX workspace_roles_single_owner_role_unique
  ON workspace_roles (workspace_id)
  WHERE kind = 'owner';
--> statement-breakpoint
CREATE INDEX workspace_roles_workspace_kind_idx
  ON workspace_roles (workspace_id, kind);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.enforce_owner_role_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'owner' THEN
      RAISE EXCEPTION 'owner role identity is immutable'
        USING ERRCODE = '23514', CONSTRAINT = 'workspace_owner_role_identity_immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.kind = 'owner' AND (
    NEW.kind <> 'owner'
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.key IS DISTINCT FROM OLD.key
  ) THEN
    RAISE EXCEPTION 'owner role identity is immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'workspace_owner_role_identity_immutable';
  END IF;

  IF OLD.kind <> 'owner' AND NEW.kind = 'owner' THEN
    RAISE EXCEPTION 'custom roles cannot be promoted to owner kind'
      USING ERRCODE = '23514', CONSTRAINT = 'workspace_owner_role_identity_immutable';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER workspace_roles_owner_identity_immutable
BEFORE UPDATE OF workspace_id, key, kind OR DELETE ON workspace_roles
FOR EACH ROW
EXECUTE FUNCTION brovexa_internal.enforce_owner_role_identity();
--> statement-breakpoint
CREATE TABLE workspace_role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES workspace_roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES permissions(key) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_role_permissions_role_permission_unique UNIQUE (role_id, permission_key)
);
--> statement-breakpoint
CREATE TABLE workspace_membership_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES workspace_memberships(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES workspace_roles(id) ON DELETE RESTRICT,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_membership_roles_membership_role_unique UNIQUE (membership_id, role_id),
  CONSTRAINT workspace_membership_roles_membership_workspace_fk
    FOREIGN KEY (membership_id, workspace_id)
    REFERENCES workspace_memberships (id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT workspace_membership_roles_role_workspace_fk
    FOREIGN KEY (role_id, workspace_id)
    REFERENCES workspace_roles (id, workspace_id)
    ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX workspace_membership_roles_workspace_idx
  ON workspace_membership_roles (workspace_id, membership_id);
--> statement-breakpoint
CREATE TABLE authorization_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT authorization_audit_events_action_check CHECK (action ~ '^[a-z][a-z0-9_.-]*$'),
  CONSTRAINT authorization_audit_events_resource_type_check CHECK (
    resource_type ~ '^[a-z][a-z0-9_.-]*$'
  )
);
--> statement-breakpoint
CREATE INDEX authorization_audit_events_workspace_created_idx
  ON authorization_audit_events (workspace_id, created_at DESC);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.assert_workspace_has_active_owner(
  p_workspace_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM workspace_roles
    WHERE workspace_id = p_workspace_id
      AND kind = 'owner'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM workspace_membership_roles AS wmr
    INNER JOIN workspace_memberships AS wm
      ON wm.id = wmr.membership_id
      AND wm.workspace_id = wmr.workspace_id
    INNER JOIN workspace_roles AS wr
      ON wr.id = wmr.role_id
      AND wr.workspace_id = wmr.workspace_id
    WHERE wmr.workspace_id = p_workspace_id
      AND wm.status = 'active'
      AND wr.kind = 'owner'
  ) THEN
    RAISE EXCEPTION 'workspace % requires at least one active owner', p_workspace_id
      USING ERRCODE = '23514', CONSTRAINT = 'workspace_requires_active_owner';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.enforce_owner_from_membership()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM brovexa_internal.assert_workspace_has_active_owner(OLD.workspace_id);
  IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    PERFORM brovexa_internal.assert_workspace_has_active_owner(NEW.workspace_id);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION brovexa_internal.enforce_owner_from_membership_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM brovexa_internal.assert_workspace_has_active_owner(OLD.workspace_id);
  IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    PERFORM brovexa_internal.assert_workspace_has_active_owner(NEW.workspace_id);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER workspace_memberships_require_active_owner
AFTER UPDATE OR DELETE ON workspace_memberships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION brovexa_internal.enforce_owner_from_membership();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER workspace_membership_roles_require_active_owner
AFTER UPDATE OR DELETE ON workspace_membership_roles
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION brovexa_internal.enforce_owner_from_membership_role();
