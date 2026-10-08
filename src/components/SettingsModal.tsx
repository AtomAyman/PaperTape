import { useState, useEffect } from 'react';
import { X, Download, FileText, Palette, Clock, Volume2, ShieldCheck, Clipboard, Type, FolderOpen, Camera, Keyboard, RotateCcw } from 'lucide-react';
import { AppSettings, Note, AppTheme, PaperType, ShortcutsConfig } from '../types';
import { THEMES, ThemeColors } from '../constants/themes';
import { exportNotesToCSV, exportNotesToMarkdownZip, DEFAULT_SHORTCUTS } from '../services/storage';
import { isMac } from '../utils/platform';
import logoUrl from '../assets/logo.png';

export function formatShortcutDisplay(accelerator: string): string {
  if (!accelerator) return 'None';
  if (isMac) {
    const parts = accelerator.split('+');
    let result = '';
    for (const part of parts) {
      const p = part.trim().toLowerCase();
      if (p === 'cmdorctrl' || p === 'commandorcontrol' || p === 'cmd' || p === 'command') {
        result += '⌘';
      } else if (p === 'alt' || p === 'option') {
        result += '⌥';
      } else if (p === 'shift') {
        result += '⇧';
      } else if (p === 'ctrl' || p === 'control') {
        result += '⌃';
      } else {
        result += part.toUpperCase();
      }
    }
    return result;
  } else {
    return accelerator
      .split('+')
      .map(part => {
        const p = part.trim().toLowerCase();
        if (p === 'cmdorctrl' || p === 'commandorcontrol' || p === 'cmd' || p === 'ctrl' || p === 'control') return 'Ctrl';
        if (p === 'alt' || p === 'option') return 'Alt';
        if (p === 'shift') return 'Shift';
        if (p === 'printscreen' || p === 'prtscn' || p === 'print') return 'PrtScn';
        return part.trim().toUpperCase();
      })
      .join('+');
  }
}

interface SettingsModalProps {
  settings: AppSettings;
  theme: ThemeColors;
  notes: Note[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  theme,
  notes,
  onUpdateSettings,
  onClose
}) => {
  const permanentCount = notes.filter(n => n.isPermanent).length;
  const ephemeralCount = notes.length - permanentCount;
  const [recordingKey, setRecordingKey] = useState<keyof ShortcutsConfig | null>(null);

  useEffect(() => {
    if (!recordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecordingKey(null);
        return;
      }

      // Ignore standalone modifier presses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('CmdOrCtrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let key = e.key.toUpperCase();
      if (key === ' ') key = 'Space';
      else if (key === 'ARROWUP') key = 'Up';
      else if (key === 'ARROWDOWN') key = 'Down';
      else if (key === 'ARROWLEFT') key = 'Left';
      else if (key === 'ARROWRIGHT') key = 'Right';
      else if (key === 'PRINTSCREEN') key = 'PrintScreen';

      // Global hotkeys require at least one modifier unless function key or PrintScreen
      if (parts.length === 0 && !key.startsWith('F') && key !== 'PrintScreen') {
        return;
      }

      parts.push(key);
      const newAccelerator = parts.join('+');

      const updatedShortcuts: ShortcutsConfig = {
        ...(settings.shortcuts || DEFAULT_SHORTCUTS),
        [recordingKey]: newAccelerator
      };

      onUpdateSettings({ ...settings, shortcuts: updatedShortcuts });
      if (window.electronAPI?.updateShortcuts) {
        window.electronAPI.updateShortcuts(updatedShortcuts);
      }
      setRecordingKey(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [recordingKey, settings, onUpdateSettings]);

  const handleResetShortcuts = () => {
    const updated = { ...DEFAULT_SHORTCUTS };
    onUpdateSettings({ ...settings, shortcuts: updated });
    if (window.electronAPI?.updateShortcuts) {
      window.electronAPI.updateShortcuts(updated);
    }
    setRecordingKey(null);
  };

  const shortcutList: Array<{
    key: keyof ShortcutsConfig;
    name: string;
    description: string;
  }> = [
    {
      key: 'toggleHud',
      name: 'Toggle PaperTape HUD',
      description: 'Show or hide scratchpad window from anywhere'
    },
    {
      key: 'interactiveCrop',
      name: 'Interactive Screen Crop',
      description: isMac
        ? '⌘⇧5-style framing box with 8 resize handles'
        : 'PrtScn framing box with 8 resize handles'
    },
    {
      key: 'screenshotStream',
      name: 'Screenshot Stream Note',
      description: 'Directly jump to the 📸 Screenshot Stream documentation note'
    },
    {
      key: 'clipboardStream',
      name: 'Clipboard Stream Note',
      description: 'Directly jump to the 📋 Clipboard Stream history note'
    }
  ];

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150">
      <div 
        className="w-full flex-1 rounded-xl overflow-hidden flex flex-col border shadow-2xl"
        style={{ backgroundColor: theme.paperBg, borderColor: theme.border }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: theme.border }}>
          <div className="flex items-center space-x-2">
            <img src={logoUrl} alt="PaperTape" className="w-5 h-5 rounded shadow-sm object-cover" />
            <span className="text-xs font-mono font-bold tracking-wider" style={{ color: theme.text }}>
              PAPERTAPE SETTINGS
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            style={{ color: theme.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs font-sans" style={{ color: theme.text }}>
          
          {/* Theme Palette */}
          <div>
            <label className="flex items-center space-x-1.5 font-mono text-[11px] font-semibold opacity-70 mb-2">
              <Palette className="w-3.5 h-3.5" />
              <span>THEME & PALETTE</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  onClick={() => onUpdateSettings({ ...settings, theme: t.id })}
                  className={`p-2.5 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                    settings.theme === t.id ? 'ring-2 ring-offset-1 scale-[1.02]' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: t.paperBg,
                    borderColor: t.border,
                    color: t.text
                  }}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.accent }} />
                  <span className="font-mono text-[11px] truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paper Texture */}
          <div>
            <label className="flex items-center space-x-1.5 font-mono text-[11px] font-semibold opacity-70 mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>PAPER TEXTURE</span>
            </label>
            <div className="flex space-x-2">
              {(['dots', 'lines', 'blank'] as PaperType[]).map((pType) => (
                <button
                  key={pType}
                  onClick={() => onUpdateSettings({ ...settings, paperType: pType })}
                  className={`flex-1 py-1.5 px-3 rounded-lg border font-mono text-center capitalize transition-all ${
                    settings.paperType === pType ? 'border-accent font-semibold shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    borderColor: settings.paperType === pType ? theme.accent : theme.border,
                    backgroundColor: settings.paperType === pType ? theme.badgeBg : 'transparent',
                    color: settings.paperType === pType ? theme.accent : theme.text
                  }}
                >
                  {pType}
                </button>
              ))}
            </div>
          </div>

          {/* Retention Policy */}
          <div>
            <label className="flex items-center space-x-1.5 font-mono text-[11px] font-semibold opacity-70 mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>DUAL RETENTION (EPHEMERAL PURGE)</span>
            </label>
            <div className="flex space-x-2">
              {[
                { days: 7, label: '7 Days' },
                { days: 30, label: '30 Days' },
                { days: 0, label: 'Never' }
              ].map(({ days, label }) => (
                <button
                  key={days}
                  onClick={() => onUpdateSettings({ ...settings, retentionDays: days })}
                  className={`flex-1 py-1.5 px-3 rounded-lg border font-mono text-center transition-all ${
                    settings.retentionDays === days ? 'border-accent font-semibold shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    borderColor: settings.retentionDays === days ? theme.accent : theme.border,
                    backgroundColor: settings.retentionDays === days ? theme.badgeBg : 'transparent',
                    color: settings.retentionDays === days ? theme.accent : theme.text
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] opacity-60 leading-relaxed">
              Unstarred scratch notes automatically expire. Notes marked <strong>STORED</strong> or in the 9 slots live permanently.
            </p>
          </div>

          {/* Workflow & Productivity Toggles */}
          <div className="pt-2 border-t space-y-3" style={{ borderColor: theme.border }}>
            <label className="font-mono text-[11px] font-semibold opacity-70 block">
              WORKFLOW & CAPABILITIES
            </label>

            {/* Auto-Clipboard Stream */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                  <Clipboard className="w-3.5 h-3.5 opacity-70" />
                  <span>Auto-Clipboard Stream</span>
                </span>
                <p className="text-[10px] opacity-60">
                  Antinote style: capture copied text to dedicated 📋 stream note
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoClipboard ?? true}
                onChange={(e) => {
                  const val = e.target.checked;
                  onUpdateSettings({ ...settings, autoClipboard: val });
                  if (window.electronAPI?.setAutoClipboard) {
                    window.electronAPI.setAutoClipboard(val);
                  }
                }}
                className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
              />
            </div>

            {/* Word & Character Counter */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                  <Type className="w-3.5 h-3.5 opacity-70" />
                  <span>Word & Character Counter</span>
                </span>
                <p className="text-[10px] opacity-60">
                  Tot style: live word/char count telemetry in the status bar
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.showWordCounter ?? false}
                onChange={(e) => onUpdateSettings({ ...settings, showWordCounter: e.target.checked })}
                className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
              />
            </div>

            {/* Markdown Mirroring */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                  <FileText className="w-3.5 h-3.5 opacity-70" />
                  <span>Mirror Notes to ~/Documents/PaperTape</span>
                </span>
                <p className="text-[10px] opacity-60">
                  Obsidian & Drafts compatibility: auto-sync notes as .md files
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {window.electronAPI?.openDocumentsFolder && (
                  <button
                    onClick={() => window.electronAPI?.openDocumentsFolder()}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100"
                    title="Open ~/Documents/PaperTape folder"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}
                <input
                  type="checkbox"
                  checked={settings.markdownSyncEnabled ?? true}
                  onChange={(e) => onUpdateSettings({ ...settings, markdownSyncEnabled: e.target.checked })}
                  className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Screen Crop Crosshair Hotkey */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                  <Camera className="w-3.5 h-3.5 opacity-70" />
                  <span>Screen Crop Crosshair</span>
                </span>
                <p className="text-[10px] opacity-60">
                  Global hotkey <strong>{formatShortcutDisplay(settings.shortcuts?.interactiveCrop || DEFAULT_SHORTCUTS.interactiveCrop)}</strong> launches interactive framing session
                </p>
              </div>
              {window.electronAPI?.captureScreenshot && (
                <button
                  onClick={() => window.electronAPI?.captureScreenshot()}
                  className="px-2 py-1 rounded border text-[10px] font-mono hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 transition-colors"
                  style={{ borderColor: theme.border }}
                >
                  Crop ({formatShortcutDisplay(settings.shortcuts?.interactiveCrop || DEFAULT_SHORTCUTS.interactiveCrop)})
                </button>
              )}
            </div>

            {/* Audio chime toggle */}
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5 font-mono text-[11px]">
                <Volume2 className="w-3.5 h-3.5 opacity-70" />
                <span>Timer Audio Chimes</span>
              </span>
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={(e) => onUpdateSettings({ ...settings, soundEffects: e.target.checked })}
                className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* KEYBOARD SHORTCUTS */}
          <div className="pt-2 border-t space-y-2.5" style={{ borderColor: theme.border }}>
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1.5 font-mono text-[11px] font-semibold opacity-70">
                <Keyboard className="w-3.5 h-3.5" />
                <span>KEYBOARD SHORTCUTS</span>
              </label>
              <button
                onClick={handleResetShortcuts}
                className="text-[10px] font-mono opacity-60 hover:opacity-100 flex items-center space-x-1 transition-opacity cursor-pointer"
                title="Reset shortcuts to defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Defaults</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {shortcutList.map(({ key, name, description }) => {
                const isRecording = recordingKey === key;
                const currentVal = settings.shortcuts?.[key] || DEFAULT_SHORTCUTS[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2 rounded-lg border transition-colors"
                    style={{ borderColor: theme.border, backgroundColor: theme.paperBg }}
                  >
                    <div className="space-y-0.5 pr-2">
                      <span className="font-mono text-[11px] font-medium block">
                        {name}
                      </span>
                      <p className="text-[10px] opacity-60 leading-tight">
                        {description}
                      </p>
                    </div>
                    <button
                      onClick={() => setRecordingKey(isRecording ? null : key)}
                      className={`shrink-0 px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                        isRecording
                          ? 'ring-2 ring-amber-500 bg-amber-500/20 text-amber-500 border-amber-500 animate-pulse'
                          : 'hover:bg-black/10 dark:hover:bg-white/10 opacity-90 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: isRecording ? '#f59e0b' : theme.border,
                        backgroundColor: isRecording ? 'rgba(245, 158, 11, 0.15)' : theme.badgeBg,
                        color: isRecording ? '#f59e0b' : theme.accent
                      }}
                      title={isRecording ? 'Press keys combination (Esc to cancel)' : 'Click to record shortcut'}
                    >
                      {isRecording ? (
                        <span>Press keys...</span>
                      ) : (
                        <>
                          <span>{formatShortcutDisplay(currentVal)}</span>
                          <span className="text-[9px] opacity-50 font-sans font-normal ml-0.5">Record</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Export & Backup */}
          <div className="pt-2 border-t space-y-2" style={{ borderColor: theme.border }}>
            <label className="font-mono text-[11px] font-semibold opacity-70 block mb-1">
              DATA PORTABILITY & BACKUP ({notes.length} NOTES)
            </label>
            <div className="text-[10px] opacity-60 mb-2">
              {permanentCount} Permanent Stored · {ephemeralCount} Ephemeral Scratchpads
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => exportNotesToCSV(notes)}
                className="flex-1 py-2 px-3 rounded-lg border flex items-center justify-center space-x-1.5 hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[11px]"
                style={{ borderColor: theme.border }}
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => exportNotesToMarkdownZip(notes)}
                className="flex-1 py-2 px-3 rounded-lg border flex items-center justify-center space-x-1.5 hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[11px]"
                style={{ borderColor: theme.border }}
              >
                <Download className="w-3 h-3" />
                <span>Export Markdown</span>
              </button>
            </div>
          </div>

          {/* About & Open Source */}
          <div className="pt-3 border-t text-[10px] space-y-2 font-mono" style={{ borderColor: theme.border }}>
            <div className="flex items-center space-x-2.5">
              <img src={logoUrl} alt="PaperTape" className="w-8 h-8 rounded-lg shadow-md border border-black/10 dark:border-white/10 object-cover shrink-0" />
              <div>
                <div className="font-bold text-xs flex items-center space-x-1" style={{ color: theme.text }}>
                  <span>PaperTape v1.0.0</span>
                  <ShieldCheck className="w-3 h-3 text-green-500 shrink-0" />
                </div>
                <div className="text-[10px] opacity-60">100% Local-First & Offline macOS Scratchpad</div>
              </div>
            </div>
            <div className="opacity-50">Free & Open-Source under MIT License. Zero Tracking.</div>
          </div>

        </div>
      </div>
    </div>
  );
};
