export type BrandKit = { name: string; website: string; font: string; primary: string; secondary: string; voice: string; logo?: string };
export type BrandState = { revision: number; brand: BrandKit };
export type StorageArea = { name: string; path: string; bytes: number; files: number; partial: boolean; unavailable?: boolean };
export type ProjectStorageArea = StorageArea & { availableBytes?: number };
export type StudioStorage = { profile: string; availableBytes?: number; areas: StorageArea[]; projects?: ProjectStorageArea[] };
export type StudioSettingsRequest = { action: 'get' } | { action: 'save-brand'; expectedRevision: number; brand: BrandKit } | { action: 'storage'; projects?: { name: string; path: string }[] };
export type StudioSettingsResult = BrandState & { storage?: StudioStorage };
export const defaultBrand: BrandKit = { name: '', website: '', font: 'Inter', primary: '#EB3514', secondary: '#FFFFFF', voice: '' };
