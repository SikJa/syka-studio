import { describe, expect, it } from 'vitest';
import { projectCaption } from '../../../docs/skills/syka-camera-3d-captions/examples/projection';
const camera = { x: 0, y: 0, z: -1200, focal: 1200, centerX: 960, centerY: 540 };
describe('native caption projection', () => {
  it('keeps the center fixed and projects farther text smaller, without history', () => {
    const center = projectCaption({ x: 0, y: 0, z: 0 }, camera);
    expect(center).toMatchObject({ x: 960, y: 540, scale: 1, depth: 1200 });
    expect(projectCaption({ x: 200, y: 0, z: 1200 }, camera)).toMatchObject({ x: 1060, scale: .5 });
    projectCaption({ x: 900, y: 300, z: 200 }, { ...camera, yaw: .2 });
    expect(projectCaption({ x: 0, y: 0, z: 0 }, camera)).toEqual(center);
  });
  it('clips planes behind/near the camera and rejects nonfinite values', () => {
    expect(projectCaption({ x: 0, y: 0, z: -1190 }, camera)).toBeNull();
    expect(projectCaption({ x: 0, y: 0, z: 20000 }, camera)).toBeNull();
    expect(() => projectCaption({ x: Infinity, y: 0, z: 0 }, camera)).toThrow('Invalid');
    expect(() => projectCaption({ x: 0, y: 0, z: 0 }, { ...camera, near: 100, far: 50 })).toThrow('clipping');
  });
});
