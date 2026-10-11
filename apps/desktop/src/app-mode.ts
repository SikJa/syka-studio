import { app } from 'electron';

// Electron infers packaging from the executable name. Our branded development
// binary has the product's name too; the launcher explicitly marks that run.
// Every resource path must use the same decision, including native helpers.
export function isPackagedBuild(): boolean {
  return Boolean(app.isPackaged && process.env.SYKA_DEV_RUN !== '1');
}
