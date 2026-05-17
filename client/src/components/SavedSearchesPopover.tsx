import { useEffect, useRef, useState } from 'react';
import type { Filters } from '../types';

const STORE_KEY = 'cc-saved-searches-v1';

interface SavedEntry {
  id: string;
  label: string;
  filters: Filters;
  createdAt: number;
}

function loadSaved(): SavedEntry[] {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as SavedEntry[]; }
  catch { return []; }
}
function persistSaved(list: SavedEntry[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
}

export function loadSavedCount(): number {
  return loadSaved().length;
}

function summarize(f: Filters): string {
  const parts: string[] = [];
  if (f.months.length === 1) {
    parts.push(new Date(f.months[0] + '-01T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  } else if (f.months.length > 1) {
    parts.push(`${f.months.length} months`);
  }
  if (f.cabinCategories.length) parts.push(f.cabinCategories.map((c) => c[0].toUpperCase() + c.slice(1)).join(' + '));
  if (f.nightsPresets.length === 1) parts.push(f.nightsPresets[0] + ' nights');
  else if (f.nightsPresets.length > 1) parts.push(`${f.nightsPresets.length} lengths`);
  if (f.shipCodes.length === 1) parts.push(f.shipCodes[0]);
  else if (f.shipCodes.length > 1) parts.push(`${f.shipCodes.length} ships`);
  return parts.length ? parts.join(' · ') : 'All sailings';
}

interface Props {
  filters: Filters;
  onClose: () => void;
  onApply: (f: Filters) => void;
  onCountChange: (n: number) => void;
}

export function SavedSearchesPopover({ filters, onClose, onApply, onCountChange }: Props) {
  const [list, setList] = useState<SavedEntry[]>(loadSaved);
  const [name, setName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [onClose]);

  const canSave = filters.cabinCategories.length > 0 || filters.months.length > 0 || filters.nightsPresets.length > 0 || filters.shipCodes.length > 0;

  const save = () => {
    const label = name.trim() || summarize(filters);
    const entry: SavedEntry = { id: 'ss' + Date.now(), label, filters, createdAt: Date.now() };
    const next = [entry, ...list].slice(0, 12);
    setList(next); persistSaved(next); setName('');
    onCountChange(next.length);
  };

  const remove = (id: string) => {
    const next = list.filter((x) => x.id !== id);
    setList(next); persistSaved(next);
    onCountChange(next.length);
  };

  return (
    <div className="cc-saved" ref={ref}>
      <div className="cc-saved-head">
        <div className="cc-saved-title">Saved searches</div>
        <button className="cc-saved-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="cc-saved-add">
        <div className="cc-saved-add-label">Save current filters</div>
        <div className="cc-saved-add-preview">{summarize(filters)}</div>
        <div className="cc-saved-add-row">
          <input
            className="cc-saved-input"
            placeholder="Name this search (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSave && save()}
          />
          <button className="cc-saved-btn" disabled={!canSave} onClick={save}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Save
          </button>
        </div>
      </div>

      <div className="cc-saved-list-head">Your searches</div>
      {list.length === 0 ? (
        <div className="cc-saved-empty">
          <svg width="42" height="42" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.5">
            <path d="M14 6h20v36l-10-7-10 7z" />
          </svg>
          <div className="cc-saved-empty-text">No saved searches yet.<br />Save a set of filters to find them fast next time.</div>
        </div>
      ) : (
        <ul className="cc-saved-list">
          {list.map((entry) => (
            <li key={entry.id} className="cc-saved-row">
              <button className="cc-saved-row-main" onClick={() => { onApply(entry.filters); onClose(); }}>
                <div className="cc-saved-row-label">{entry.label}</div>
                <div className="cc-saved-row-sub">{summarize(entry.filters)}</div>
              </button>
              <button className="cc-saved-row-del" onClick={() => remove(entry.id)} title="Remove">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 4h10M6 4V2.5h4V4M5 4l1 10h4l1-10" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
