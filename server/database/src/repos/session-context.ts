/**
 * Session-carried identity types (kept separate to avoid circular imports).
 */

export type RoleName = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: RoleName;
}

export interface SessionContext {
  user: SessionUser;
  organizationId: string;
}
