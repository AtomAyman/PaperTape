import React, { useState, useEffect, useCallback } from 'react';
import { Note, AppSettings, Attachment } from './types';
import { THEMES } from './constants/themes';
import { 
  loadNotes, 
  saveNotes, 
  loadSettings, 
  saveSettings, 
  purgeExpiredNotes 
} from './services/storage';
import { MenuBarPopover } from './components/MenuBarPopover';
import { SearchView } from './components/SearchView';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [notes, setNotes] = useState<Note[]>(() => {
    const loaded = loadNotes();
    const { active } = purgeExpiredNotes(loaded, loadSettings().retentionDays);
    return active;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPinned, setIsPinned] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeTheme = THEMES[settings.theme] || THEMES.A24;
  const currentNote = notes[currentIndex] || {
    id: 'empty',
    content: '',
    dbIndex: 0,
    isArchived: false,
    isLocked: false,
    isPrivate: false,
    isSlotted: false,
    slotIndex: null,
    isPermanent: false,
    created: Date.now(),
    lastModified: Date.now()
  };

  // Dual-layer persistence: LevelDB (localStorage) + Atomic JSON vault file on disk
  useEffect(() => {
    saveNotes(notes);
    if (window.electronAPI?.saveVaultBackup) {
      window.electronAPI.saveVaultBackup(notes);
    }
  }, [notes]);

  // Restore from atomic vault file if localStorage was ever cleared or reset
  useEffect(() => {
    if (window.electronAPI?.loadVaultBackup) {
      window.electronAPI.loadVaultBackup().then((vaultNotes) => {
        if (vaultNotes && vaultNotes.length > 0) {
          setNotes(prev => {
            if (prev.length <= 1 && !prev[0].content) {
              return vaultNotes;
            }
            return prev;
          });
        }
      });
    }
  }, []);

  // Sync initial shortcuts, auto-clipboard, and pin state with backend
  useEffect(() => {
    if (window.electronAPI?.updateShortcuts && settings.shortcuts) {
      window.electronAPI.updateShortcuts(settings.shortcuts);
    }
    if (window.electronAPI?.setAutoClipboard) {
      window.electronAPI.setAutoClipboard(settings.autoClipboard ?? true);
    }
    if (window.electronAPI?.getPinState) {
      window.electronAPI.getPinState().then(pin => setIsPinned(pin));
    }
  }, []);

  // Prevent Edge/WebView2 default browser context menu on Windows
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // Auto-clipboard background listener (Antinote feature)
  useEffect(() => {
    if (!window.electronAPI?.onClipboardSnippet) return;

    const cleanup = window.electronAPI.onClipboardSnippet((snippet) => {
      if (settings.autoClipboard === false) return;
      if (!snippet.text || !snippet.text.trim()) return;

      setNotes(prev => {
        const streamIdx = prev.findIndex(n => n.id === 'clipboard_stream');
        const timeStr = new Date(snippet.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const entry = `\n\n---\n**${timeStr}**:\n${snippet.text}`;

        if (streamIdx !== -1) {
          const updated = [...prev];
          const streamNote = updated[streamIdx];
          if (streamNote.content.endsWith(snippet.text)) {
            return prev;
          }
          updated[streamIdx] = {
            ...streamNote,
            content: streamNote.content.trimEnd() + entry,
            lastModified: Date.now()
          };
          return updated;
        } else {
          const newStreamNote: Note = {
            id: 'clipboard_stream',
            content: `# 📋 Clipboard Stream\n\nAuto-captured clipboard history.${entry}`,
            dbIndex: -1,
            isArchived: false,
            isLocked: false,
            isPrivate: false,
            isSlotted: false,
            slotIndex: null,
            isPermanent: true,
            created: Date.now(),
            lastModified: Date.now()
          };
          return [...prev, newStreamNote];
        }
      });
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [settings.autoClipboard]);

  // Auto-screenshot listener (dedicated 1 Screenshots file / stream)
  useEffect(() => {
    if (!window.electronAPI?.onScreenshotCaptured) return;

    const cleanup = window.electronAPI.onScreenshotCaptured((shot) => {
      const timeStr = new Date(shot.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const newAttachment: Attachment = {
        id: `shot_${shot.timestamp || Date.now()}`,
        name: shot.filename || `Screenshot ${timeStr}`,
        type: 'image/png',
        dataUrl: shot.dataUrl,
        filePath: shot.filePath,
        createdAt: shot.timestamp || Date.now(),
        caption: ''
      };

      setNotes(prev => {
        const streamIdx = prev.findIndex(n => n.id === 'screenshots_stream');
        if (streamIdx !== -1) {
          const updated = [...prev];
          const streamNote = updated[streamIdx];
          const existingAttachments = streamNote.attachments || [];
          // Strip out any legacy raw markdown path lines from earlier versions
          const cleanedContent = streamNote.content
            .replace(/\n*---\n\*\*\d+:\d+.*?\n!\[.*?\]\(.*?\)/g, '')
            .trim();
          updated[streamIdx] = {
            ...streamNote,
            content: cleanedContent || '# 📸 Screenshot Stream\n\nScreenshots and notes documentation.',
            attachments: [...existingAttachments, newAttachment],
            lastModified: Date.now()
          };
          return updated;
        } else {
          const newStreamNote: Note = {
            id: 'screenshots_stream',
            content: '# 📸 Screenshot Stream\n\nScreenshots and notes documentation.',
            dbIndex: -2,
            isArchived: false,
            isLocked: false,
            isPrivate: false,
            isSlotted: false,
            slotIndex: null,
            isPermanent: true,
            created: Date.now(),
            lastModified: Date.now(),
            attachments: [newAttachment]
          };
          return [newStreamNote, ...prev];
        }
      });

      // Switch view directly to the screenshot stream note!
      setTimeout(() => {
        setNotes(curr => {
          const idx = curr.findIndex(n => n.id === 'screenshots_stream');
          if (idx !== -1) setCurrentIndex(idx);
          return curr;
        });
      }, 50);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Obsidian / Local Markdown Mirroring (~/Documents/PaperTape)
  useEffect(() => {
    if (!settings.markdownSyncEnabled) return;
    if (!window.electronAPI?.saveMarkdownNote) return;

    const timeout = setTimeout(() => {
      notes.forEach((n) => {
        if (n.isPermanent || n.isSlotted) {
          const firstLine = n.content.split('\n')[0].replace(/^#+\s*/, '').trim();
          let title = firstLine;
          if (!title) {
            title = n.slotIndex !== null ? `Page ${n.slotIndex + 1}` : (n.id === 'clipboard_stream' ? 'Clipboard Stream' : (n.id === 'screenshots_stream' ? 'Screenshot Stream' : `Note ${n.id}`));
          }

          let markdownContent = n.content;
          if (n.id === 'screenshots_stream' && n.attachments && n.attachments.length > 0) {
            markdownContent = (n.content ? n.content.trim() + '\n\n' : '') +
              n.attachments.map(a => {
                const time = new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `### 📸 ${time} - ${a.name}\n\n![${a.name}](${a.filePath || a.name})\n\n${a.caption ? `${a.caption}\n` : ''}`;
              }).join('\n---\n\n');
          }

          window.electronAPI?.saveMarkdownNote({
            title,
            content: markdownContent,
            id: n.id
          });
        }
      });
    }, 1000);

    return () => clearTimeout(timeout);
  }, [notes, settings.markdownSyncEnabled]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  // Pin toggle
  const handleTogglePin = async () => {
    if ((window as any).electronAPI?.togglePin) {
      const pinned = await (window as any).electronAPI.togglePin();
      setIsPinned(pinned);
    } else {
      setIsPinned(prev => !prev);
    }
  };

  // Deck Navigation
  const handlePrev = useCallback(() => {
    if (currentIndex < notes.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, notes.length]);

  const handleNext = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleJumpToFront = useCallback(() => {
    setCurrentIndex(0);
  }, []);

  const handlePromoteToFront = useCallback(() => {
    if (currentIndex <= 0) return;
    setNotes(prev => {
      const copy = [...prev];
      const [promoted] = copy.splice(currentIndex, 1);
      promoted.lastModified = Date.now();
      return [promoted, ...copy];
    });
    setCurrentIndex(0);
  }, [currentIndex]);

  const handleNewNote = useCallback(() => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      content: '',
      dbIndex: Date.now(),
      isArchived: false,
      isLocked: false,
      isPrivate: false,
      isSlotted: false,
      slotIndex: null,
      isPermanent: false,
      created: Date.now(),
      lastModified: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    setCurrentIndex(0);
  }, []);

  const handleDeleteNote = useCallback(() => {
    if (notes.length <= 1) {
      setNotes([{
        ...notes[0],
        content: '',
        lastModified: Date.now()
      }]);
      return;
    }

    setNotes(prev => prev.filter((_, idx) => idx !== currentIndex));
    if (currentIndex >= notes.length - 1) {
      setCurrentIndex(Math.max(0, notes.length - 2));
    }
  }, [currentIndex, notes]);

  const handleTogglePermanent = useCallback(() => {
    setNotes(prev => prev.map((n, idx) => {
      if (idx === currentIndex) {
        return { ...n, isPermanent: !n.isPermanent, lastModified: Date.now() };
      }
      return n;
    }));
  }, [currentIndex]);

  const handleSelectSlot = useCallback((slotIdx: number) => {
    const existingIndex = notes.findIndex(n => n.isSlotted && n.slotIndex === slotIdx);
    if (existingIndex !== -1) {
      setCurrentIndex(existingIndex);
    } else {
      const slottedNote: Note = {
        id: `slot_${slotIdx}_${Date.now()}`,
        content: `# Page ${slotIdx + 1}\n\n`,
        dbIndex: Date.now(),
        isArchived: false,
        isLocked: false,
        isPrivate: false,
        isSlotted: true,
        slotIndex: slotIdx,
        isPermanent: true,
        created: Date.now(),
        lastModified: Date.now()
      };
      setNotes(prev => [slottedNote, ...prev]);
      setCurrentIndex(0);
    }
  }, [notes]);

  const handleSelectClipboardStream = useCallback(() => {
    const streamIdx = notes.findIndex(n => n.id === 'clipboard_stream');
    if (streamIdx !== -1) {
      setCurrentIndex(streamIdx);
    } else {
      const newStreamNote: Note = {
        id: 'clipboard_stream',
        content: `# 📋 Clipboard Stream\n\nAuto-captured clipboard history from macOS.\n\n---\n**${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}**:\n(Stream initialized)`,
        dbIndex: -1,
        isArchived: false,
        isLocked: false,
        isPrivate: false,
        isSlotted: false,
        slotIndex: null,
        isPermanent: true,
        created: Date.now(),
        lastModified: Date.now()
      };
      setNotes(prev => [newStreamNote, ...prev]);
      setCurrentIndex(0);
    }
  }, [notes]);

  const handleSelectScreenshotStream = useCallback(() => {
    const streamIdx = notes.findIndex(n => n.id === 'screenshots_stream');
    if (streamIdx !== -1) {
      setCurrentIndex(streamIdx);
    } else {
      const newStreamNote: Note = {
        id: 'screenshots_stream',
        content: '# 📸 Screenshot Stream\n\nScreenshots and notes documentation from macOS.',
        dbIndex: -2,
        isArchived: false,
        isLocked: false,
        isPrivate: false,
        isSlotted: false,
        slotIndex: null,
        isPermanent: true,
        created: Date.now(),
        lastModified: Date.now(),
        attachments: []
      };
      setNotes(prev => [newStreamNote, ...prev]);
      setCurrentIndex(0);
    }
  }, [notes]);

  // Global hotkey navigation directly to stream notes
  useEffect(() => {
    if (!window.electronAPI?.onNavigateToStream) return;
    const cleanup = window.electronAPI.onNavigateToStream((streamType) => {
      if (streamType === 'screenshots_stream') {
        handleSelectScreenshotStream();
      } else if (streamType === 'clipboard_stream') {
        handleSelectClipboardStream();
      }
    });
    return () => {
      if (cleanup) cleanup();
    };
  }, [handleSelectScreenshotStream, handleSelectClipboardStream]);

  const handleTriggerScreenshot = useCallback(async () => {
    if (window.electronAPI?.captureScreenshot) {
      await window.electronAPI.captureScreenshot();
    }
  }, []);

  const handleAddAttachment = useCallback((attachment: Attachment) => {
    setNotes(prev => prev.map((n, idx) => {
      if (idx === currentIndex) {
        const existing = n.attachments || [];
        return {
          ...n,
          attachments: [...existing, attachment],
          lastModified: Date.now()
        };
      }
      return n;
    }));
  }, [currentIndex]);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setNotes(prev => prev.map((n, idx) => {
      if (idx === currentIndex && n.attachments) {
        return {
          ...n,
          attachments: n.attachments.filter(a => a.id !== attachmentId),
          lastModified: Date.now()
        };
      }
      return n;
    }));
  }, [currentIndex]);

  const handleUpdateAttachmentCaption = useCallback((attachmentId: string, caption: string) => {
    setNotes(prev => prev.map((n, idx) => {
      if (idx === currentIndex && n.attachments) {
        return {
          ...n,
          attachments: n.attachments.map(a => a.id === attachmentId ? { ...a, caption } : a),
          lastModified: Date.now()
        };
      }
      return n;
    }));
  }, [currentIndex]);

  const handleUpdateContent = (newContent: string) => {
    setNotes(prev => prev.map((n, idx) => {
      if (idx === currentIndex) {
        return { ...n, content: newContent, lastModified: Date.now() };
      }
      return n;
    }));
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Prevent accidental browser reload on F5 or Ctrl+R / Cmd+R
      if (e.key === 'F5' || (isCmdOrCtrl && (e.key === 'r' || e.key === 'R'))) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Escape') {
        if (isSearchOpen) setIsSearchOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else {
          // Blur active editor or close window
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          if ((window as any).electronAPI?.closeWindow) {
            (window as any).electronAPI.closeWindow();
          }
        }
        return;
      }

      // Quick slot page switching with numbers (1 to 5) or 0 for Clipboard Stream
      const numKey = parseInt(e.key, 10);
      if (numKey === 0) {
        if (isCmdOrCtrl || e.altKey) {
          e.preventDefault();
          handleSelectClipboardStream();
          return;
        } else if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          handleSelectClipboardStream();
          return;
        }
      } else if (!isNaN(numKey) && numKey >= 1 && numKey <= 5) {
        if (isCmdOrCtrl || e.altKey) {
          e.preventDefault();
          handleSelectSlot(numKey - 1);
          return;
        } else if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          handleSelectSlot(numKey - 1);
          return;
        }
      }

      if (isCmdOrCtrl && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        handleSelectClipboardStream();
        return;
      }

      if (
        e.key === 'PrintScreen' ||
        (e.altKey && e.shiftKey && (e.key === 's' || e.key === 'S')) || 
        (isCmdOrCtrl && e.shiftKey && (e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        handleTriggerScreenshot();
        return;
      }

      if (isCmdOrCtrl && e.shiftKey && (e.key === 'x' || e.key === 'X' || e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        handleSelectScreenshotStream();
        return;
      }

      if (isCmdOrCtrl) {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          handleNewNote();
        } else if (e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          handleDeleteNote();
        } else if (e.key === '[' ) {
          e.preventDefault();
          handlePrev();
        } else if (e.key === ']') {
          e.preventDefault();
          handleNext();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          handleTogglePin();
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setIsSearchOpen(true);
        } else if (e.key === ',') {
          e.preventDefault();
          setIsSettingsOpen(true);
        } else if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          handleTogglePermanent();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleNewNote, 
    handleDeleteNote, 
    handlePrev, 
    handleNext, 
    handleJumpToFront, 
    handlePromoteToFront, 
    handleTogglePermanent, 
    handleSelectSlot,
    handleSelectClipboardStream,
    handleSelectScreenshotStream,
    handleTriggerScreenshot,
    handleTogglePin,
    isSearchOpen,
    isSettingsOpen
  ]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-transparent p-0">
      <MenuBarPopover
        note={currentNote}
        noteIndex={currentIndex}
        totalNotes={notes.length}
        settings={settings}
        theme={activeTheme}
        isPinned={isPinned}
        onUpdateContent={handleUpdateContent}
        onPrev={handlePrev}
        onNext={handleNext}
        onJumpToFront={handleJumpToFront}
        onPromoteToFront={handlePromoteToFront}
        onNewNote={handleNewNote}
        onDeleteNote={handleDeleteNote}
        onTogglePermanent={handleTogglePermanent}
        onSelectSlot={handleSelectSlot}
        onSelectClipboardStream={handleSelectClipboardStream}
        onSelectScreenshotStream={handleSelectScreenshotStream}
        onTriggerScreenshot={handleTriggerScreenshot}
        onAddAttachment={handleAddAttachment}
        onRemoveAttachment={handleRemoveAttachment}
        onUpdateAttachmentCaption={handleUpdateAttachmentCaption}
        onTogglePin={handleTogglePin}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {isSearchOpen && (
        <SearchView
          notes={notes}
          theme={activeTheme}
          onSelectNote={(noteId) => {
            const found = notes.findIndex(n => n.id === noteId);
            if (found !== -1) setCurrentIndex(found);
          }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          theme={activeTheme}
          notes={notes}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
};
