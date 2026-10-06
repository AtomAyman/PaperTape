import { Note, AppSettings, ShortcutsConfig } from '../types';
import tutorialNotesData from '../data/tutorial_notes.json';

const NOTES_KEY = 'papertape_notes_v2';
const SETTINGS_KEY = 'papertape_settings_v2';
const TRASH_KEY = 'papertape_trash_v2';

export const DEFAULT_SHORTCUTS: ShortcutsConfig = {
  toggleHud: 'Alt+A',
  interactiveCrop: 'Alt+Shift+S',
  screenshotStream: 'CmdOrCtrl+Shift+X',
  clipboardStream: 'CmdOrCtrl+Shift+V'
};

export const DEFAULT_SETTINGS: AppSettings = {
  paperType: 'dots',
  paperOpacity: 'subtle',
  theme: 'A24',
  retentionDays: 7, // 7 days ephemeral default
  isDetached: false, // Default: Mac Notch mode
  soundEffects: true,
  autoClipboard: true,       // Antinote feature: Auto-capture copied text to clipboard stream
  showWordCounter: false,     // Tot feature: Live word & character counter in status bar
  markdownSyncEnabled: true, // Obsidian/Drafts feature: Mirror permanent notes to ~/Documents/PaperTape
  shortcuts: DEFAULT_SHORTCUTS,
  triggers: {
    sum: 'sum',
    avg: 'avg',
    count: 'count',
    timer: 'timer',
    checklist: '/x'
  }
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        shortcuts: {
          ...DEFAULT_SHORTCUTS,
          ...(parsed.shortcuts || {})
        }
      };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) {
      const parsed: Note[] = JSON.parse(raw);
      if (parsed.length > 0) {
        return parsed.map(n => {
          if (n.id === 'screenshots_stream') {
            const cleaned = n.content.replace(/\n*---\n\*\*\d+:\d+.*?\n!\[.*?\]\(.*?\)/g, '').trim();
            return {
              ...n,
              content: cleaned || '# 📸 Screenshot Stream\n\nScreenshots and notes documentation from macOS.'
            };
          }
          return n;
        });
      }
    }
  } catch (e) {
    console.error('Failed to load notes from localStorage:', e);
  }

  // Seed with clean interactive tutorial cards
  const initialNotes: Note[] = (tutorialNotesData as any[]).map((n) => ({
    id: n.id,
    content: n.content || '',
    dbIndex: n.dbIndex,
    isArchived: Boolean(n.isArchived),
    isLocked: Boolean(n.isLocked),
    isPrivate: Boolean(n.isPrivate),
    isSlotted: Boolean(n.isSlotted),
    slotIndex: n.slotIndex !== undefined ? n.slotIndex : null,
    isPermanent: true, // Tutorial cards are permanent
    created: n.created || Date.now(),
    lastModified: n.lastModified || Date.now()
  }));

  saveNotes(initialNotes);
  return initialNotes;
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save notes:', e);
  }
}

export function purgeExpiredNotes(notes: Note[], retentionDays: number): { active: Note[]; purgedCount: number } {
  if (retentionDays <= 0) return { active: notes, purgedCount: 0 };
  
  const now = Date.now();
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  
  const active: Note[] = [];
  const purged: Note[] = [];

  for (const n of notes) {
    if (n.isPermanent || n.isSlotted || n.created > cutoff) {
      active.push(n);
    } else {
      purged.push(n);
    }
  }

  if (purged.length > 0) {
    try {
      const existingTrashRaw = localStorage.getItem(TRASH_KEY);
      const existingTrash: Note[] = existingTrashRaw ? JSON.parse(existingTrashRaw) : [];
      localStorage.setItem(TRASH_KEY, JSON.stringify([...purged, ...existingTrash]));
    } catch (e) {
      console.error('Failed to save purged notes to trash:', e);
    }
  }

  return { active, purgedCount: purged.length };
}

export function exportNotesToCSV(notes: Note[]): void {
  const headers = ['id', 'created', 'lastModified', 'isPermanent', 'isSlotted', 'slotIndex', 'content'];
  const rows = notes.map(n => [
    n.id,
    new Date(n.created).toISOString(),
    new Date(n.lastModified).toISOString(),
    n.isPermanent ? '1' : '0',
    n.isSlotted ? '1' : '0',
    n.slotIndex !== null ? n.slotIndex : '',
    `"${(n.content || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `papertape_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportNotesToMarkdownZip(notes: Note[]): void {
  const combined = notes.map((n, i) => {
    const title = n.content.split('\n')[0].slice(0, 40) || `Note ${i + 1}`;
    return `# ${title}\n*Created: ${new Date(n.created).toLocaleString()} | Stored: ${n.isPermanent ? 'Permanent' : 'Ephemeral'}*\n\n${n.content}\n\n---\n`;
  }).join('\n');

  const blob = new Blob([combined], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `papertape_notes_${new Date().toISOString().slice(0, 10)}.md`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
