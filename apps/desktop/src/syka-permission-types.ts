export const PERMISSION_IDS = ['clipboard', 'fonts', 'microphone', 'notifications'] as const;
export type StudioPermission = typeof PERMISSION_IDS[number];
export type StudioPermissions = Record<StudioPermission, boolean>;
export type PermissionRequest = { action: 'get' } | { action: 'set'; permission: StudioPermission; allowed: boolean } | { action: 'system-microphone' };
