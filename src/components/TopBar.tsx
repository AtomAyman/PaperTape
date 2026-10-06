import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Search, 
  Pin, 
  PinOff,
  Settings, 
  ArrowUpToLine,
  Bookmark,
  Clock,
  Sparkles
} from 'lucide-react';
import { Note, AppSettings, SlotConfig } from '../types';
import { DEFAULT_SLOTS, ThemeColors } from '../constants/themes';

interface TopBarProps {
  currentNote: Note;
  noteIndex: number;
  totalNotes: number;
  settings: AppSettings;
  theme: ThemeColors;
  onPrev: () => void;
  onNext: () => void;
  onJumpToFront: () => void;
  onPromoteToFront: () => void;
  onNewNote: () => void;
  onDeleteNote: () => void;
  onTogglePermanent: () => void;
  onSelectSlot: (slotIndex: number) => void;
  onToggleDetach: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentNote,
  noteIndex,
  totalNotes,
  settings,
  theme,
  onPrev,
  onNext,
  onJumpToFront,
  onPromoteToFront,
  onNewNote,
  onDeleteNote,
  onTogglePermanent,
  onSelectSlot,
  onToggleDetach,
  onOpenSearch,
  onOpenSettings
}) => {
  return (
    <div 
      className="flex flex-col border-b select-none transition-all duration-200"
      style={{ 
        borderColor: theme.border,
        backgroundColor: theme.bg
      }}
    >
      {/* Top row: 9 Slots (Tot-style) & Window Mode */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ borderColor: theme.border }}>
        {/* 9 Permanent Slot Dots */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-mono tracking-wider opacity-60 mr-1" style={{ color: theme.textMuted }}>
            SLOTS:
          </span>
          {DEFAULT_SLOTS.map((slot) => {
            const isCurrent = currentNote.isSlotted && currentNote.slotIndex === slot.index;
            return (
              <button
                key={slot.index}
                onClick={() => onSelectSlot(slot.index)}
                title={`${slot.name} (Slot ${slot.index + 1})`}
                className={`w-3.5 h-3.5 rounded-full transition-transform duration-150 flex items-center justify-center hover:scale-125 ${
                  isCurrent ? 'ring-2 ring-offset-1 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: slot.color,
                  boxShadow: isCurrent ? `0 0 8px ${slot.color}` : 'none'
                }}
              />
            );
          })}
        </div>

        {/* Pin / Detach & Settings */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleDetach}
            title={settings.isDetached ? "Dock to MacBook Notch" : "Detach as Floating HUD (⌘P)"}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: settings.isDetached ? theme.accent : theme.textMuted }}
          >
            {settings.isDetached ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onOpenSettings}
            title="Settings (⌘,)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: theme.textMuted }}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle row: Deck Navigation & Actions */}
      <div className="flex items-center justify-between px-3 py-1.5">
        {/* Navigation Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onPrev}
            disabled={noteIndex >= totalNotes - 1}
            title="Previous Note (⌘[)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            style={{ color: theme.text }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span 
            className="text-[11px] font-mono px-1.5 py-0.5 rounded cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
            onClick={onJumpToFront}
            title="Click to Jump to Front (⌘1)"
            style={{ color: theme.text }}
          >
            {noteIndex + 1} / {totalNotes}
          </span>

          <button
            onClick={onNext}
            disabled={noteIndex <= 0}
            title="Next Note (⌘])"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 transition-colors"
            style={{ color: theme.text }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onPromoteToFront}
            title="Promote this note to Front (⌘⇧1)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors ml-1"
            style={{ color: theme.textMuted }}
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dual-Retention Pill */}
        <button
          onClick={onTogglePermanent}
          title={currentNote.isPermanent ? "Stored in Vault (Never expires)" : "Ephemeral scratchpad (Auto-purges). Click to save permanently."}
          className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all duration-150 border"
          style={{
            backgroundColor: currentNote.isPermanent ? theme.badgeBg : 'transparent',
            borderColor: currentNote.isPermanent ? theme.accent : theme.border,
            color: currentNote.isPermanent ? theme.accent : theme.textMuted
          }}
        >
          {currentNote.isPermanent ? (
            <>
              <Bookmark className="w-2.5 h-2.5 fill-current" />
              <span>STORED</span>
            </>
          ) : (
            <>
              <Clock className="w-2.5 h-2.5" />
              <span>SCRATCH</span>
            </>
          )}
        </button>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onOpenSearch}
            title="Search Notes (⌘F)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: theme.text }}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onNewNote}
            title="New Scratch Note (⌘N)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            style={{ color: theme.accent }}
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={onDeleteNote}
            title="Delete Note (⌘D)"
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors opacity-60 hover:opacity-100 hover:text-red-500"
            style={{ color: theme.text }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
