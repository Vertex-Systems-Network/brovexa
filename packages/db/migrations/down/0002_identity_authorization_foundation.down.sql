DROP TRIGGER IF EXISTS workspace_membership_roles_require_active_owner ON workspace_membership_roles;
--> statement-breakpoint
DROP TRIGGER IF EXISTS workspace_memberships_require_active_owner ON workspace_memberships;
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.enforce_owner_from_membership_role();
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.enforce_owner_from_membership();
--> statement-breakpoint
DROP FUNCTION IF EXISTS brovexa_internal.assert_workspace_has_active_owner(uuid);
--> statement-breakpoint
DROP TABLE IF EXISTS authorization_audit_events;
--> statement-breakpoint
DROP TABLE IF EXISTS workspace_membership_roles;
--> statement-breakpoint
DROP TABLE IF EXISTS workspace_role_permissions;
--> statement-breakpoint
DROP TABLE IF EXISTS workspace_roles;
--> statement-breakpoint
DROP TABLE IF EXISTS permissions;
--> statement-breakpoint
DROP TABLE IF EXISTS workspace_memberships;
--> statement-breakpoint
DROP TABLE IF EXISTS users;
