import type { Filters } from './types';

const STORE_KEY = 'cc-saved-searches-v1';

export interface SavedEntry {
  id: string;
  label: string;
  filters: Filters;
  createdAt: number;
}

export function loadSaved(): SavedEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as SavedEntry[];
  } catch {
    return [];
  }
}

export function persistSaved(list: SavedEntry[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  } catch (error) {
    console.warn('Unable to persist saved searches', error);
  }
}

export function loadSavedCount(): number {
  return loadSaved().length;
}
