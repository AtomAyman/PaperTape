import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, X, Bookmark, Clock } from 'lucide-react';
import { Note } from '../types';
import { ThemeColors } from '../constants/themes';

interface SearchViewProps {
  notes: Note[];
  theme: ThemeColors;
  onSelectNote: (noteId: string) => void;
  onClose: () => void;
}

export const SearchView: React.FC<SearchViewProps> = ({
  notes,
  theme,
  onSelectNote,
  onClose
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filtered = notes.filter(n => {
    if (!query.trim()) return true;
    return n.content.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150">
      <div 
        className="w-full flex-1 rounded-xl overflow-hidden flex flex-col border shadow-2xl"
        style={{ backgroundColor: theme.paperBg, borderColor: theme.border }}
      >
        {/* Search Input Bar */}
        <div className="p-3 border-b flex items-center space-x-2" style={{ borderColor: theme.border }}>
          <SearchIcon className="w-4 h-4 opacity-60" style={{ color: theme.text }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all notes..."
            className="flex-1 bg-transparent outline-none text-sm font-sans"
            style={{ color: theme.text }}
          />
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
            style={{ color: theme.textMuted }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y" style={{ borderColor: theme.border }}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs opacity-50 font-mono" style={{ color: theme.textMuted }}>
              No matching notes found.
            </div>
          ) : (
            filtered.map((note) => {
              const preview = note.content.trim().slice(0, 90) || '(Empty Note)';
              const dateStr = new Date(note.created).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              });

              return (
                <div
                  key={note.id}
                  onClick={() => {
                    onSelectNote(note.id);
                    onClose();
                  }}
                  className="p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-start justify-between space-x-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-sans line-clamp-2 leading-relaxed" style={{ color: theme.text }}>
                      {preview}
                    </p>
                    <div className="flex items-center space-x-2 mt-1.5 text-[10px] font-mono opacity-60">
                      <span>{dateStr}</span>
                      {note.isSlotted && (
                        <span className="px-1 rounded bg-black/10 dark:bg-white/10">
                          Slot {Number(note.slotIndex) + 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    {note.isPermanent ? (
                      <Bookmark className="w-3 h-3 text-amber-500 fill-current" />
                    ) : (
                      <Clock className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
