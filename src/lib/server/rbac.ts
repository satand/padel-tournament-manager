export type Role = 'SUPER_ADMIN' | 'ORGANIZER' | 'REFEREE' | 'PLAYER' | 'PUBLIC_VIEWER';
export type Permission =
  | 'tournament:create'
  | 'tournament:update'
  | 'participants:update'
  | 'schedule:update'
  | 'result:update'
  | 'ranking:view'
  | 'public:view'
  | 'settings:update';

const permissionsByRole: Record<Role, Permission[]> = {
  SUPER_ADMIN: ['tournament:create', 'tournament:update', 'participants:update', 'schedule:update', 'result:update', 'ranking:view', 'public:view', 'settings:update'],
  ORGANIZER: ['tournament:create', 'tournament:update', 'participants:update', 'schedule:update', 'result:update', 'ranking:view', 'public:view', 'settings:update'],
  REFEREE: ['result:update', 'ranking:view', 'public:view'],
  PLAYER: ['ranking:view', 'public:view'],
  PUBLIC_VIEWER: ['public:view']
};

export function can(role: Role, permission: Permission): boolean {
  return permissionsByRole[role]?.includes(permission) ?? false;
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new Error(`Permesso negato: ${permission}`);
}
