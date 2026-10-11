export type CaptionPoint = { x: number; y: number; z: number };
export type CaptionCamera = CaptionPoint & { focal: number; centerX: number; centerY: number; yaw?: number; pitch?: number; roll?: number; near?: number; far?: number };

/** Absolute, stateless pinhole projection. Angles in radians; composition units. */
export function projectCaption(point: CaptionPoint, camera: CaptionCamera) {
  const values = [...Object.values(point), ...Object.values(camera)];
  if (values.some(value => !Number.isFinite(value)) || camera.focal <= 0) throw Error('Invalid caption camera.');
  const near = camera.near ?? 40, far = camera.far ?? 10000;
  if (near <= 0 || far <= near) throw Error('Invalid caption clipping planes.');
  const yaw = -(camera.yaw ?? 0), pitch = -(camera.pitch ?? 0), roll = -(camera.roll ?? 0);
  const dx = point.x - camera.x, dy = point.y - camera.y, dz = point.z - camera.z;
  const rx = Math.cos(yaw) * dx + Math.sin(yaw) * dz, rz = -Math.sin(yaw) * dx + Math.cos(yaw) * dz;
  const ry = Math.cos(pitch) * dy - Math.sin(pitch) * rz, depth = Math.sin(pitch) * dy + Math.cos(pitch) * rz;
  if (depth < near || depth > far) return null;
  const scale = camera.focal / depth;
  return { x: camera.centerX + (Math.cos(roll) * rx - Math.sin(roll) * ry) * scale,
    y: camera.centerY + (Math.sin(roll) * rx + Math.cos(roll) * ry) * scale, scale, depth, rotation: -roll * 180 / Math.PI };
}
