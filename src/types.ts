export type PaperType = 'dots' | 'lines' | 'blank';
export type PaperOpacity = 'subtle' | 'medium' | 'crisp';
export type AppTheme = 'A24' | 'MuadDib' | 'TokyoNeon' | 'VintagePaper' | 'ObsidianNoir';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  filePath?: string;
  createdAt: number;
  caption?: string;
}

export interface Note {
  id: string;
  content: string;
  dbIndex: number;
  isArchived: boolean;
  isLocked: boolean;
  isPrivate: boolean;
  isSlotted: boolean;
  slotIndex: number | null; // 0 through 8 for 9 slots
  isPermanent: boolean;     // Permanent Vault vs Ephemeral Scratch
  created: number;
  lastModified: number;
  attachments?: Attachment[];
}

export interface SlotConfig {
  index: number;
  name: string;
  color: string;
}

export interface ShortcutsConfig {
  toggleHud: string;
  interactiveCrop: string;
  screenshotStream: string;
  clipboardStream: string;
}

export interface AppSettings {
  paperType: PaperType;
  paperOpacity: PaperOpacity;
  theme: AppTheme;
  retentionDays: number; // 7, 30, or 0 (never purge)
  isDetached: boolean;   // Detached floating HUD vs Notch Drop-down
  soundEffects: boolean;
  autoClipboard: boolean;       // Antinote feature: Auto-capture copied text to clipboard stream
  showWordCounter: boolean;     // Tot feature: Live word & character counter in status bar
  markdownSyncEnabled: boolean; // Obsidian/Drafts feature: Mirror permanent notes to ~/Documents/PaperTape
  shortcuts: ShortcutsConfig;   // Programmable Hotkeys
  triggers: {
    sum: string;
    avg: string;
    count: string;
    timer: string;
    checklist: string;
  };
}

export interface EvaluatedLine {
  lineIndex: number;
  text: string;
  isChecklist: boolean;
  isChecked: boolean;
  calcResult?: string | number | null;
  timerConfig?: {
    type: 'stopwatch' | 'countdown' | 'pomo';
    totalSeconds: number;
    label: string;
  };
}

declare global {
  interface Window {
    electronAPI?: {
      togglePin: () => Promise<boolean>;
      getPinState: () => Promise<boolean>;
      resizeWindow: (size: { width: number; height: number }) => void;
      closeWindow: () => void;
      setAutoClipboard: (enabled: boolean) => void;
      onClipboardSnippet: (callback: (data: { text: string; timestamp: number }) => void) => () => void;
      saveMarkdownNote: (noteData: { title: string; content: string; id: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
      openDocumentsFolder: () => Promise<boolean>;
      captureScreenshot: () => Promise<{ success: boolean }>;
      onScreenshotCaptured: (callback: (data: { dataUrl: string; filePath: string; filename: string; timestamp: number }) => void) => () => void;
      copyImageToClipboard: (dataUrl: string) => Promise<boolean>;
      saveVaultBackup: (notes: Note[]) => Promise<{ success: boolean; error?: string }>;
      loadVaultBackup: () => Promise<Note[] | null>;
      sendNotification: (data: { title: string; body: string }) => Promise<boolean>;
      isElectron?: boolean;

      // Programmable Hotkeys & Interactive Framing Session
      updateShortcuts: (shortcuts: ShortcutsConfig) => Promise<{ success: boolean }>;
      confirmCrop: (rect: { x: number; y: number; width: number; height: number }, copyToClipboardOnly?: boolean) => Promise<{ success: boolean }>;
      cancelCrop: () => Promise<boolean>;
      onNavigateToStream: (callback: (streamType: 'screenshots_stream' | 'clipboard_stream') => void) => () => void;
    };
  }
}

