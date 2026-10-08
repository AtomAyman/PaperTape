import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Search, 
  Pin, 
  PinOff,
  Settings, 
  ArrowUpToLine,
  Bookmark,
  Clock,
  Play,
  Pause,
  RotateCcw,
  CheckSquare,
  Square,
  PlusCircle,
  Bell,
  X,
  ListTodo,
  Clipboard,
  Camera,
  Image as ImageIcon,
  FileText,
  Download
} from 'lucide-react';
import { Note, AppSettings, SlotConfig, Attachment } from '../types';
import { ThemeColors, DEFAULT_SLOTS, EXTRA_SLOTS } from '../constants/themes';
import { evaluateNoteContent, LineEvaluation } from '../services/engine';
import { ReminderData } from '../services/reminderEngine';
import { isMac, screenshotKeyLabel, screenshotKeyHint } from '../utils/platform';
import logoUrl from '../assets/logo.png';

interface MenuBarPopoverProps {
  note: Note;
  noteIndex: number;
  totalNotes: number;
  settings: AppSettings;
  theme: ThemeColors;
  isPinned: boolean;
  onUpdateContent: (content: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpToFront: () => void;
  onPromoteToFront: () => void;
  onNewNote: () => void;
  onDeleteNote: () => void;
  onTogglePermanent: () => void;
  onSelectSlot: (slotIndex: number) => void;
  onSelectClipboardStream?: () => void;
  onSelectScreenshotStream?: () => void;
  onTriggerScreenshot?: () => void;
  onAddAttachment?: (attachment: Attachment) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onUpdateAttachmentCaption?: (attachmentId: string, caption: string) => void;
  onTogglePin: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}

export const MenuBarPopover: React.FC<MenuBarPopoverProps> = ({
  note,
  noteIndex,
  totalNotes,
  settings,
  theme,
  isPinned,
  onUpdateContent,
  onPrev,
  onNext,
  onJumpToFront,
  onPromoteToFront,
  onNewNote,
  onDeleteNote,
  onTogglePermanent,
  onSelectSlot,
  onSelectClipboardStream,
  onSelectScreenshotStream,
  onTriggerScreenshot,
  onAddAttachment,
  onRemoveAttachment,
  onUpdateAttachmentCaption,
  onTogglePin,
  onOpenSearch,
  onOpenSettings
}) => {
  const [evaluations, setEvaluations] = useState<LineEvaluation[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<number, { seconds: number; isRunning: boolean }>>({});
  const [ringingTimers, setRingingTimers] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState<string | null>(null);
  const [copiedWordId, setCopiedWordId] = useState<string | null>(null);
  const [copiedAllWord, setCopiedAllWord] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<SlotConfig[]>(DEFAULT_SLOTS);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [dueReminders, setDueReminders] = useState<ReminderData[]>([]);
  const notifiedReminderIdsRef = useRef<Set<string>>(new Set());
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          if (onAddAttachment) {
            onAddAttachment({
              id: `att_${Date.now()}`,
              name: file.name || 'Pasted Image',
              type: file.type,
              dataUrl: reader.result as string,
              createdAt: Date.now()
            });
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Tot style live telemetry
  const wordCount = useMemo(() => {
    const text = note.content.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [note.content]);
  const charCount = note.content.length;

  // Auto-scroll to bottom if viewing dedicated Clipboard Stream or Screenshot Stream
  useEffect(() => {
    if (note.id === 'clipboard_stream' && textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 50);
    } else if (note.id === 'screenshots_stream' && streamEndRef.current) {
      setTimeout(() => {
        streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [note.id, noteIndex, note.attachments?.length]);

  const formatCaptureTime = (ts?: any) => {
    if (!ts) return '';
    let date: Date | null = null;
    if (typeof ts === 'number') {
      date = new Date(ts);
    } else if (typeof ts === 'string') {
      const num = Number(ts);
      if (!isNaN(num) && num > 1000000) {
        date = new Date(num);
      } else {
        const parsed = new Date(ts);
        if (!isNaN(parsed.getTime())) {
          date = parsed;
        }
      }
    }

    if (date && !isNaN(date.getTime())) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today, ${timeStr}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[date.getMonth()]} ${date.getDate()}, ${timeStr}`;
    }

    // Fallback for string-based timestamps like "08:04 PM"
    if (typeof ts === 'string' && ts.trim().length > 0 && !ts.includes('NaN') && !ts.includes('Invalid')) {
      return `Today, ${ts.trim()}`;
    }

    return `Today, ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getCardTitle = (att: Attachment) => {
    if (att.name && !att.name.includes('Invalid Date')) {
      return att.name;
    }
    const cleanTime = formatCaptureTime(att.createdAt).replace('Today, ', '');
    return `Screenshot ${cleanTime || 'Capture'}`;
  };

  const copyRichContentToClipboard = async (htmlContent: string, plainContent: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([htmlContent], { type: 'text/html' });
        const blobText = new Blob([plainContent], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          })
        ]);
        return true;
      }
    } catch (e) {
      console.warn('Navigator clipboard write failed, trying fallback:', e);
    }

    // Fallback using invisible contentEditable DOM element
    try {
      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.opacity = '0';
      document.body.appendChild(container);

      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(container);
      selection?.removeAllRanges();
      selection?.addRange(range);

      const success = document.execCommand('copy');
      selection?.removeAllRanges();
      document.body.removeChild(container);
      return success;
    } catch (e) {
      console.error('Fallback HTML copy failed:', e);
      return false;
    }
  };

  const generateCardHtml = (att: Attachment): { html: string; text: string } => {
    const title = getCardTitle(att);
    const time = formatCaptureTime(att.createdAt);
    const caption = att.caption?.trim() || '';

    const html = `
<div style="font-family: Calibri, 'Segoe UI', -apple-system, Arial, sans-serif; margin-bottom: 24px; color: #1f2937;">
  <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 6px;">
    📸 ${title} <span style="font-size: 12px; font-weight: normal; color: #6b7280;">(${time})</span>
  </div>
  <div style="margin: 8px 0 12px 0;">
    <img src="${att.dataUrl}" alt="${title}" style="max-width: 100%; height: auto; border: 1px solid #d1d5db; border-radius: 6px; display: block;" />
  </div>
  ${caption ? `<div style="font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap; background-color: #f9fafb; padding: 10px 14px; border-left: 3px solid #3b82f6; border-radius: 4px; margin-top: 6px;">${caption.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
</div>`;

    const text = `📸 ${title} (${time})\n\n[Screenshot attached]\n\n${caption ? `Notes:\n${caption}\n` : ''}\n----------------------------------------\n`;

    return { html, text };
  };

  const generateFullStreamHtml = (currentNote: Note): { html: string; text: string } => {
    const noteTitle = currentNote.id === 'screenshots_stream' 
      ? '📸 Screenshot Stream & Documentation' 
      : 'Notes & Screenshots';
    const noteSummary = currentNote.content?.replace(/^#\s*📸\s*Screenshot Stream.*?\n+/i, '').trim() || '';
    const attachments = currentNote.attachments || [];

    const cardsHtml = attachments.map(att => generateCardHtml(att).html).join('\n');
    const cardsText = attachments.map(att => generateCardHtml(att).text).join('\n');

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${noteTitle}</title>
</head>
<body style="font-family: Calibri, 'Segoe UI', -apple-system, Arial, sans-serif; max-width: 800px; margin: 20px auto; color: #1f2937; line-height: 1.5;">
  <h1 style="font-size: 22px; color: #111827; margin-bottom: 8px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
    ${noteTitle}
  </h1>
  ${noteSummary ? `<div style="font-size: 14px; color: #4b5563; margin-bottom: 20px; white-space: pre-wrap; background-color: #f3f4f6; padding: 12px; border-radius: 6px;">${noteSummary.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
  <div style="margin-top: 16px;">
    ${cardsHtml}
  </div>
</body>
</html>`;

    const fullText = `${noteTitle}\n${noteSummary ? `\n${noteSummary}\n` : ''}\n========================================\n\n${cardsText}`;

    return { html: fullHtml, text: fullText };
  };

  const handleCopyCardForWord = async (att: Attachment) => {
    const { html, text } = generateCardHtml(att);
    const success = await copyRichContentToClipboard(html, text);
    if (success) {
      setCopiedWordId(att.id);
      setTimeout(() => setCopiedWordId(null), 2000);
    }
  };

  const handleCopyAllForWord = async (currentNote: Note) => {
    const { html, text } = generateFullStreamHtml(currentNote);
    const success = await copyRichContentToClipboard(html, text);
    if (success) {
      setCopiedAllWord(true);
      setTimeout(() => setCopiedAllWord(false), 2000);
    }
  };

  const handleExportAsDoc = (currentNote: Note) => {
    const { html } = generateFullStreamHtml(currentNote);
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `PaperTape_Screenshots_${dateStr}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyImageToClipboard = async (dataUrl: string, attId: string) => {
    try {
      if (window.electronAPI?.copyImageToClipboard) {
        await window.electronAPI.copyImageToClipboard(dataUrl);
      } else {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
      }
      setCopiedImageId(attId);
      setTimeout(() => setCopiedImageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy image to clipboard:', err);
    }
  };

  const handleScrollToScreenshot = (attId: string, dataUrl: string) => {
    const el = document.getElementById(`screenshot-${attId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setLightboxImage(dataUrl);
    }
  };

  // Resize drag state
  const isResizingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0, w: 460, h: 600 });

  // Play audio chime for completed timer
  const playTimerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      // 3-tone ascending bell chime: 587Hz (D5) -> 880Hz (A5) -> 1174Hz (D6)
      const now = ctx.currentTime;
      const notes = [587.33, 880.00, 1174.66];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.16);
        gain.gain.setValueAtTime(0, now + i * 0.16);
        gain.gain.linearRampToValueAtTime(0.3, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.36);
      });
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  };

  useEffect(() => {
    const evals = evaluateNoteContent(note.content);
    setEvaluations(evals);

    evals.forEach((ev, idx) => {
      if (ev.triggerType === 'timer' && ev.timerData && !activeTimers[idx]) {
        setActiveTimers(prev => ({
          ...prev,
          [idx]: { seconds: ev.timerData!.seconds, isRunning: false }
        }));
      }
    });
  }, [note.content]);

  // Timer tick interval
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimers(prev => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const k = Number(key);
          const t = next[k];
          if (t && t.isRunning) {
            changed = true;
            const evalItem = evaluations[k];
            if (evalItem?.timerData?.type === 'stopwatch') {
              next[k] = { ...t, seconds: t.seconds + 1 };
            } else {
              if (t.seconds > 1) {
                next[k] = { ...t, seconds: t.seconds - 1 };
              } else if (t.seconds === 1) {
                // Timer completed!
                next[k] = { ...t, seconds: 0, isRunning: false };
                setRingingTimers(r => (r.includes(k) ? r : [...r, k]));
                playTimerChime();
                if ('Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification('PaperTape Timer Complete', {
                      body: evalItem?.timerData?.label || 'Your timer has finished!'
                    });
                  } catch (e) {}
                }
              }
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [evaluations]);

  // Periodic Reminder & Scheduled To-Do Checker (checks every 5 seconds)
  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      evaluations.forEach((ev) => {
        if (ev.reminderData && !ev.isChecked) {
          const rem = ev.reminderData;
          // Trigger when scheduled time has arrived or is today and within due window
          const isDue = now >= rem.targetTimestamp;
          if (isDue && !notifiedReminderIdsRef.current.has(rem.id)) {
            notifiedReminderIdsRef.current.add(rem.id);
            setDueReminders(prev => [...prev, rem]);
            if (settings.soundEffects) {
              playTimerChime();
            }
            if (window.electronAPI?.sendNotification) {
              window.electronAPI.sendNotification({
                title: `🔔 PaperTape Reminder: ${rem.dayLabel}`,
                body: `${rem.title} (${rem.timeLabel})`
              });
            } else if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`🔔 PaperTape Reminder: ${rem.dayLabel}`, {
                  body: `${rem.title} (${rem.timeLabel})`
                });
              } catch (e) {}
            }
          }
        }
      });
    };

    checkReminders();
    const interval = setInterval(checkReminders, 5000);
    return () => clearInterval(interval);
  }, [evaluations, settings.soundEffects]);

  const handleCopy = () => {
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleAddExtraSlot = () => {
    if (availableSlots.length < DEFAULT_SLOTS.length + EXTRA_SLOTS.length) {
      const nextIndex = availableSlots.length;
      const extra = EXTRA_SLOTS[nextIndex - DEFAULT_SLOTS.length];
      if (extra) {
        setAvailableSlots(prev => [...prev, extra]);
      }
    }
  };

  // Toggle checklist item cleanly without deleting the line
  const toggleChecklist = (lineIdx: number) => {
    const lines = note.content.split('\n');
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const line = lines[lineIdx];
      let updatedLine = line;

      // Check prefix format: "- [x]", "- [ ]", "[x]", "[ ]"
      if (/^(\s*[-*]?\s*)\[x\]/i.test(line)) {
        updatedLine = line.replace(/(\s*[-*]?\s*)\[x\]/i, '$1[ ]');
      } else if (/^(\s*[-*]?\s*)\[ \]/i.test(line)) {
        updatedLine = line.replace(/(\s*[-*]?\s*)\[ \]/i, '$1[x]');
      }
      // Check suffix format: "/x", "/ "
      else if (line.trim().endsWith('/x') || line.trim().endsWith('/X')) {
        updatedLine = line.replace(/\/x$/i, '/ ');
      } else if (line.trim().endsWith('/')) {
        updatedLine = line.replace(/\/$/i, '/x');
      } else if (line.trim().endsWith('/ ')) {
        updatedLine = line.replace(/\/ $/i, '/x');
      } else {
        updatedLine = `${line.trimEnd()} /x`;
      }

      lines[lineIdx] = updatedLine;
      onUpdateContent(lines.join('\n'));
    }
  };

  // Insert a new checklist item at cursor or end
  const handleInsertChecklist = () => {
    const lines = note.content.split('\n');
    lines.push('- [ ] ');
    onUpdateContent(lines.join('\n'));
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  };

  const toggleTimer = (idx: number) => {
    if (ringingTimers.includes(idx)) {
      setRingingTimers(r => r.filter(i => i !== idx));
    }
    setActiveTimers(prev => {
      const current = prev[idx] || { seconds: evaluations[idx]?.timerData?.seconds || 0, isRunning: false };
      return { ...prev, [idx]: { ...current, isRunning: !current.isRunning } };
    });
  };

  const resetTimer = (idx: number) => {
    setRingingTimers(r => r.filter(i => i !== idx));
    setActiveTimers(prev => {
      const initial = evaluations[idx]?.timerData?.initialSeconds || 0;
      return { ...prev, [idx]: { seconds: initial, isRunning: false } };
    });
  };

  const formatTimerSeconds = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Resize Grab Handle Drag Handler
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    startPosRef.current = {
      x: e.screenX,
      y: e.screenY,
      w: window.innerWidth,
      h: window.innerHeight
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaX = moveEvent.screenX - startPosRef.current.x;
      const deltaY = moveEvent.screenY - startPosRef.current.y;
      const newW = Math.max(320, Math.min(1000, startPosRef.current.w + deltaX));
      const newH = Math.max(360, Math.min(1200, startPosRef.current.h + deltaY));

      if ((window as any).electronAPI?.resizeWindow) {
        (window as any).electronAPI.resizeWindow({ width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const paperClass = 
    settings.paperType === 'dots' ? 'paper-dots' :
    settings.paperType === 'lines' ? 'paper-lines' : 'paper-blank';

  // Extract checklist items
  const checklistItems = useMemo(() => {
    return evaluations
      .map((ev, idx) => ({ ev, idx }))
      .filter(({ ev }) => ev.triggerType === 'checklist');
  }, [evaluations]);

  // Extract variables, timers, and math results
  const calculationItems = useMemo(() => {
    return evaluations
      .map((ev, idx) => ({ ev, idx }))
      .filter(({ ev }) => ev.isTrigger && ev.triggerType !== 'checklist');
  }, [evaluations]);

  return (
    <div 
      className="w-full h-full flex flex-col select-none rounded-2xl border overflow-hidden transition-colors duration-150"
      style={{
        backgroundColor: theme.bg,
        borderColor: theme.border,
        color: theme.text,
        '--line-color': theme.lineColor,
        '--dot-color': theme.dotColor,
        '--paper-bg': theme.paperBg
      } as any}
    >
      {/* 
        RINGING TIMER ALERT BANNER
      */}
      {ringingTimers.length > 0 && (
        <div 
          className="flex items-center justify-between px-4 py-2 bg-amber-500 text-black font-mono text-xs font-bold animate-pulse shadow-md z-30 shrink-0"
        >
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 animate-bounce" />
            <span>⏰ TIMER COMPLETE!</span>
          </div>
          <button
            onClick={() => setRingingTimers([])}
            className="flex items-center space-x-1 px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded text-[11px] font-semibold"
          >
            <span>Dismiss</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 
        DUE REMINDER ALERT BANNER
      */}
      {dueReminders.length > 0 && (
        <div 
          className="flex items-center justify-between px-4 py-2 bg-indigo-600 text-white font-mono text-xs font-bold animate-pulse shadow-md z-30 shrink-0 border-b border-indigo-400"
        >
          <div className="flex items-center space-x-2 truncate mr-2">
            <Bell className="w-4 h-4 text-amber-300 animate-bounce shrink-0" />
            <span className="truncate">
              🔔 REMINDER: {dueReminders[0].title} ({dueReminders[0].dayLabel} · {dueReminders[0].timeLabel})
            </span>
          </div>
          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => setDueReminders(prev => prev.slice(1))}
              className="flex items-center space-x-1 px-2 py-0.5 bg-black/30 hover:bg-black/50 rounded text-[11px] font-semibold text-white"
            >
              <span>Dismiss</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 
        HEADER: 5 Default Permanent Slots & Pin / Settings
      */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{
          backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.04)',
          borderColor: theme.border
        }}
      >
        {/* 5 Slots + Add button */}
        <div className="flex items-center space-x-2">
          <span 
            className="text-[10px] font-mono tracking-wider mr-0.5"
            style={{ color: theme.textMuted }}
          >
            PAGES:
          </span>
          {availableSlots.map((slot) => {
            const isCurrent = note.isSlotted && note.slotIndex === slot.index;
            return (
              <button
                key={slot.index}
                onClick={() => onSelectSlot(slot.index)}
                title={`${slot.name} (${isMac ? '⌘' : 'Ctrl+'}${slot.index + 1})`}
                className={`relative w-5 h-5 rounded-full transition-transform flex items-center justify-center font-mono text-[9px] font-bold text-white shadow-sm hover:scale-115 ${
                  isCurrent ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: slot.color }}
              >
                {slot.index + 1}
              </button>
            );
          })}

          {availableSlots.length < 9 && (
            <button
              onClick={handleAddExtraSlot}
              title="Add Page Slot"
              className="p-0.5 transition-colors hover:scale-110"
              style={{ color: theme.textMuted }}
            >
              <PlusCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Crop Screen, Screenshot Stream, Clipboard Stream, Pin & Settings */}
        <div className="flex items-center space-x-1">
          {onTriggerScreenshot && (
            <button
              onClick={onTriggerScreenshot}
              title={`Crop Screen Area (${screenshotKeyHint})`}
              className="p-1 rounded transition-colors hover:scale-110 active:scale-95"
              style={{ color: theme.textMuted }}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          )}

          {onSelectScreenshotStream && (
            <button
              onClick={onSelectScreenshotStream}
              title="Open Screenshot Stream (1 notebook for all captures)"
              className="p-1 rounded transition-colors hover:scale-105"
              style={{
                color: note.id === 'screenshots_stream' ? theme.accent : theme.textMuted,
                backgroundColor: note.id === 'screenshots_stream' ? theme.badgeBg : 'transparent'
              }}
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </button>
          )}

          {onSelectClipboardStream && (
            <button
              onClick={onSelectClipboardStream}
              title="Open Clipboard Stream (auto-captured snippets)"
              className="p-1 rounded transition-colors hover:scale-105"
              style={{
                color: note.id === 'clipboard_stream' ? theme.accent : theme.textMuted,
                backgroundColor: note.id === 'clipboard_stream' ? theme.badgeBg : 'transparent'
              }}
            >
              <Clipboard className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onTogglePin}
            title={isPinned ? "Pinned: Window stays open" : `Unpinned: Closes when clicking away (${isMac ? '⌘P' : 'Ctrl+P'})`}
            className="p-1 rounded transition-colors"
            style={{
              color: isPinned ? theme.accent : theme.textMuted,
              backgroundColor: isPinned ? theme.badgeBg : 'transparent'
            }}
          >
            {isPinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onOpenSettings}
            title={`Settings (${isMac ? '⌘,' : 'Ctrl+,'})`}
            className="p-1 rounded transition-colors"
            style={{ color: theme.textMuted }}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 
        NAVIGATION BAR: Deck Card Controls & Promotion
      */}
      <div 
        className="flex items-center justify-between px-4 py-1.5 border-b shrink-0"
        style={{
          backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
          borderColor: theme.border
        }}
      >
        <div className="flex items-center space-x-1.5">
          <button
            onClick={onPrev}
            disabled={noteIndex >= totalNotes - 1}
            title={`Previous Card (${isMac ? '⌘[' : 'Ctrl+['})`}
            className="p-1 rounded disabled:opacity-30 transition-colors"
            style={{ color: theme.textMuted }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span 
            onClick={onJumpToFront}
            title={`Click to Jump to Front (${isMac ? '⌘1' : 'Ctrl+1'})`}
            className="text-[11px] font-mono px-2 py-0.5 rounded cursor-pointer"
            style={{ color: theme.text }}
          >
            {noteIndex + 1} / {totalNotes}
          </span>

          <button
            onClick={onNext}
            disabled={noteIndex <= 0}
            title={`Next Card (${isMac ? '⌘]' : 'Ctrl+]'})`}
            className="p-1 rounded disabled:opacity-30 transition-colors"
            style={{ color: theme.textMuted }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={onPromoteToFront}
            title={`Promote card to front (${isMac ? '⌘⇧1' : 'Ctrl+Shift+1'})`}
            className="p-1 rounded transition-colors ml-1"
            style={{ color: theme.textMuted }}
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dual-Retention Badge */}
        <button
          onClick={onTogglePermanent}
          title={note.isPermanent ? "Stored in Vault (Never expires)" : "Ephemeral scratchpad (Auto-purges). Click to save permanently."}
          className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all border"
          style={{
            backgroundColor: note.isPermanent ? theme.badgeBg : 'transparent',
            borderColor: note.isPermanent ? theme.accent : theme.border,
            color: note.isPermanent ? theme.accent : theme.textMuted
          }}
        >
          {note.isPermanent ? (
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

        {/* Search */}
        <button
          onClick={onOpenSearch}
          title={`Search Notes (${isMac ? '⌘F' : 'Ctrl+F'})`}
          className="p-1 rounded transition-colors"
          style={{ color: theme.textMuted }}
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 
        SCREENSHOT REEL / ATTACHMENTS
        Visible if note has screen crops or pasted images
      */}
      {note.attachments && note.attachments.length > 0 && (
        <div 
          className="px-4 py-2 border-b flex space-x-2.5 overflow-x-auto shrink-0 z-20"
          style={{
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.03)',
            borderColor: theme.border
          }}
        >
          {note.attachments.map((att) => (
            <div 
              key={att.id} 
              className="group relative shrink-0 rounded-lg overflow-hidden border shadow-sm transition-transform hover:scale-[1.02]"
              style={{ borderColor: theme.border }}
            >
              <img 
                src={att.dataUrl} 
                alt={att.name} 
                onClick={() => handleScrollToScreenshot(att.id, att.dataUrl)}
                className="h-20 w-auto object-cover max-w-[160px] cursor-pointer" 
                title={`${att.name} (Click to view in document)`}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2 pointer-events-none group-hover:pointer-events-auto">
                <button
                  onClick={() => setLightboxImage(att.dataUrl)}
                  title="View full resolution"
                  className="p-1 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <Search className="w-3 h-3" />
                </button>
                {onRemoveAttachment && (
                  <button
                    onClick={() => onRemoveAttachment(att.id)}
                    title="Remove screenshot"
                    className="p-1 rounded-full bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div 
                className="absolute bottom-0 inset-x-0 bg-black/75 px-1.5 py-0.5 text-[9px] font-mono text-white/90 truncate pointer-events-none"
              >
                {getCardTitle(att)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 
        MAIN WRITING / SCREENSHOT DOCUMENT CANVAS
      */}
      <div 
        className="relative flex-1 flex flex-col overflow-hidden"
        style={{
          backgroundColor: theme.paperBg
        }}
      >
        {note.id === 'screenshots_stream' ? (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Top Document Title & Notes */}
            <div 
              className="p-4 border-b shrink-0 space-y-1.5"
              style={{ borderColor: theme.border }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold tracking-wider opacity-75 uppercase" style={{ color: theme.accent }}>
                  📸 SCREENSHOT STREAM & DOCUMENTATION
                </span>
                <div className="flex items-center space-x-1.5">
                  {note.attachments && note.attachments.length > 0 && (
                    <>
                      <button
                        onClick={() => handleCopyAllForWord(note)}
                        title="Copy all screenshots and notes formatted for Word, Docs, or email"
                        className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all hover:scale-105 active:scale-95 shadow-xs"
                        style={{
                          backgroundColor: copiedAllWord ? '#10B981' : (theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                          color: copiedAllWord ? '#ffffff' : theme.accent
                        }}
                      >
                        {copiedAllWord ? (
                          <>
                            <Check className="w-3 h-3 text-white" />
                            <span>Copied All to Word!</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3" />
                            <span>Copy All for Word</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleExportAsDoc(note)}
                        title="Export & download as a Word document (.doc) with all images & notes"
                        className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                        style={{ color: theme.textMuted }}
                      >
                        <Download className="w-3 h-3" />
                        <span>Export .doc</span>
                      </button>
                    </>
                  )}
                  <span className="text-[10px] font-mono opacity-60 ml-1" style={{ color: theme.textMuted }}>
                    {note.attachments?.length || 0} CAPTURE{(note.attachments?.length || 0) === 1 ? '' : 'S'}
                  </span>
                </div>
              </div>
              <textarea
                value={note.content}
                onChange={(e) => onUpdateContent(e.target.value)}
                placeholder="Add documentation notes, project summary, or instructions here..."
                rows={2}
                className="w-full text-xs font-mono bg-transparent outline-none resize-none"
                style={{ color: theme.text }}
              />
            </div>

            {/* List of Screenshot Cards with Real Inline Images */}
            <div className="p-4 space-y-4 flex-1">
              {note.attachments && note.attachments.length > 0 ? (
                note.attachments.map((att) => (
                  <div
                    key={att.id}
                    id={`screenshot-${att.id}`}
                    className="rounded-xl border p-3.5 space-y-3 transition-all shadow-sm"
                    style={{
                      backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      borderColor: theme.border
                    }}
                  >
                    {/* Card Header: Timestamp, Name, Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold shrink-0"
                          style={{ backgroundColor: theme.badgeBg, color: theme.accent }}
                        >
                          {formatCaptureTime(att.createdAt)}
                        </span>
                        <span className="text-[11px] font-mono truncate opacity-60" style={{ color: theme.text }}>
                          {getCardTitle(att)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        {/* Copy for Word / Docs */}
                        <button
                          onClick={() => handleCopyCardForWord(att)}
                          title="Copy image and note formatted for Word, Docs, or OneNote"
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          style={{ color: copiedWordId === att.id ? '#10B981' : theme.accent }}
                        >
                          {copiedWordId === att.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied for Word!</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5" />
                              <span>Copy for Word</span>
                            </>
                          )}
                        </button>

                        {/* Copy Image to System Clipboard */}
                        <button
                          onClick={() => handleCopyImageToClipboard(att.dataUrl, att.id)}
                          title="Copy Image to Clipboard"
                          className="flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-mono transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          style={{ color: copiedImageId === att.id ? '#10B981' : theme.textMuted }}
                        >
                          {copiedImageId === att.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Image</span>
                            </>
                          )}
                        </button>

                        {/* Enlarge in Lightbox */}
                        <button
                          onClick={() => setLightboxImage(att.dataUrl)}
                          title="Enlarge Full Size"
                          className="p-1 rounded transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                          style={{ color: theme.textMuted }}
                        >
                          <Search className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Screenshot */}
                        {onRemoveAttachment && (
                          <button
                            onClick={() => onRemoveAttachment(att.id)}
                            title="Delete Screenshot"
                            className="p-1 rounded transition-colors hover:bg-red-500/20 text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Image Itself */}
                    <div
                      className="relative rounded-lg overflow-hidden border cursor-pointer group bg-black/5 dark:bg-black/40 flex items-center justify-center shadow-sm"
                      style={{ borderColor: theme.border }}
                      onClick={() => setLightboxImage(att.dataUrl)}
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="w-full max-h-[380px] object-contain transition-transform group-hover:scale-[1.01]"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="bg-black/75 text-white text-[11px] font-mono px-2.5 py-1 rounded-full shadow-lg">
                          Click to enlarge
                        </span>
                      </div>
                    </div>

                    {/* Editable Caption / Notes under the Image */}
                    <div>
                      <textarea
                        value={att.caption || ''}
                        onChange={(e) => onUpdateAttachmentCaption?.(att.id, e.target.value)}
                        placeholder="Add notes, steps, or explanation for this screenshot..."
                        rows={2}
                        className="w-full text-xs font-mono p-2.5 rounded-lg border bg-transparent outline-none resize-y transition-colors focus:ring-1"
                        style={{
                          borderColor: theme.border,
                          color: theme.text,
                          backgroundColor: theme.isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)'
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 px-6 text-center space-y-3">
                  <Camera className="w-10 h-10 mx-auto opacity-50" style={{ color: theme.accent }} />
                  <div className="font-mono font-semibold text-sm" style={{ color: theme.text }}>
                    No Screenshots Captured Yet
                  </div>
                  <p className="text-xs opacity-70 max-w-xs mx-auto leading-relaxed" style={{ color: theme.textMuted }}>
                    Press <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-bold">{screenshotKeyLabel}</kbd> anywhere on your {isMac ? 'Mac' : 'PC'} to crop any screen area, and it will automatically be placed right here in your notes.
                  </p>
                  {onTriggerScreenshot && (
                    <button
                      onClick={onTriggerScreenshot}
                      className="mt-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: theme.accent }}
                    >
                      Crop Screen Area Now
                    </button>
                  )}
                </div>
              )}

              {/* Bottom Quick Action: Crop another area */}
              {note.attachments && note.attachments.length > 0 && onTriggerScreenshot && (
                <div className="pt-2 pb-4 flex justify-center">
                  <button
                    onClick={onTriggerScreenshot}
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-dashed hover:border-solid transition-all text-xs font-mono font-medium"
                    style={{ borderColor: theme.accent, color: theme.accent }}
                  >
                    <Camera className="w-4 h-4" />
                    <span>+ Crop Another Area ({screenshotKeyLabel})</span>
                  </button>
                </div>
              )}
              <div ref={streamEndRef} />
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(e) => onUpdateContent(e.target.value)}
            onPaste={handlePaste}
            placeholder="Start writing... (e.g. rate: 85, hours: 40, rate * hours = or sum, - [ ] task)"
            className={`w-full h-full bg-transparent resize-none outline-none font-mono text-[14.5px] leading-[32px] px-6 py-4 whitespace-pre-wrap break-words selection:bg-amber-500/30 overflow-y-auto ${paperClass}`}
            style={{
              lineHeight: '32px',
              paddingTop: '16px',
              paddingBottom: '16px',
              paddingLeft: '24px',
              paddingRight: '24px',
              color: theme.text,
              caretColor: theme.accent,
              boxSizing: 'border-box'
            }}
            autoFocus
          />
        )}
      </div>

      {/* 
        INTERACTIVE CHECKLIST / TASKS PANEL
        Shows when note has checklists (starts with "- [ ]" or ends with "/x")
      */}
      {checklistItems.length > 0 && (
        <div 
          className="px-4 py-2 border-t max-h-[130px] overflow-y-auto shrink-0"
          style={{
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.04)',
            borderColor: theme.border
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span 
              className="text-[10px] font-mono font-bold tracking-wider uppercase flex items-center space-x-1"
              style={{ color: theme.textMuted }}
            >
              <ListTodo className="w-3 h-3 text-emerald-400" />
              <span>
                CHECKLIST ({checklistItems.filter(i => i.ev.isChecked).length}/{checklistItems.length} DONE)
              </span>
            </span>
          </div>

          <div className="space-y-1">
            {checklistItems.map(({ ev, idx }) => (
              <button
                key={idx}
                onClick={() => toggleChecklist(idx)}
                className="w-full flex items-center space-x-2 text-left px-2 py-1 rounded transition-colors group hover:bg-white/5"
                style={{
                  color: ev.isChecked ? theme.textMuted : theme.text
                }}
              >
                {ev.isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 opacity-70 group-hover:opacity-100 shrink-0" style={{ color: theme.accent }} />
                )}
                <span 
                  className={`text-xs font-mono truncate ${ev.isChecked ? 'line-through opacity-70' : 'font-medium'}`}
                  style={{
                    color: ev.isChecked ? theme.textMuted : theme.text
                  }}
                >
                  {ev.cleanText || 'Task item'}
                </span>
                {ev.reminderData && (
                  <span 
                    className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center space-x-1 shrink-0 ${
                      ev.reminderData.isPastDue || ev.reminderData.isToday
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/35'
                    }`}
                    title={`Scheduled for ${ev.reminderData.targetDateStr} (${ev.reminderData.relativeStr})`}
                  >
                    <Bell className="w-2.5 h-2.5 shrink-0" />
                    <span>{ev.reminderData.dayLabel} {ev.reminderData.timeLabel}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 
        REACTIVE MATH & VARIABLES HIGHLIGHT BAR
        Distinct, vibrant colored pills for variables, sums, and equations!
      */}
      {calculationItems.length > 0 && (
        <div 
          className="px-4 py-2 border-t flex flex-wrap gap-2 items-center shrink-0"
          style={{
            backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.06)',
            borderColor: theme.border
          }}
        >
          {calculationItems.map(({ ev, idx }) => {
            // Timer Widget
            if (ev.triggerType === 'timer' && ev.timerData) {
              const timerState = activeTimers[idx] || { seconds: ev.timerData.seconds, isRunning: false };
              const isRinging = ringingTimers.includes(idx);
              return (
                <div 
                  key={idx}
                  className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono border transition-all ${
                    isRinging 
                      ? 'bg-amber-500 text-black border-amber-400 font-bold animate-pulse' 
                      : 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                  }`}
                >
                  <span className="font-semibold">{formatTimerSeconds(timerState.seconds)}</span>
                  <button onClick={() => toggleTimer(idx)} className="p-0.5 hover:opacity-80">
                    {timerState.isRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                  </button>
                  <button onClick={() => resetTimer(idx)} className="p-0.5 hover:opacity-80">
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            }

            // Math Aggregators: sum / total / avg / count (Vibrant Purple Highlight)
            if (ev.triggerType === 'sum' || ev.triggerType === 'avg' || ev.triggerType === 'count') {
              const label = 
                ev.triggerType === 'sum' ? 'TOTAL' :
                ev.triggerType === 'avg' ? 'AVG' : 'COUNT';

              return (
                <div 
                  key={idx}
                  className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border shadow-sm"
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                    color: '#E9D5FF'
                  }}
                >
                  <span className="text-[#C084FC] uppercase text-[10px]">{label}:</span>
                  <span className="font-extrabold text-white">{ev.result}</span>
                </div>
              );
            }

            // Math Expression (=), Date, Duration, Timezone (Vibrant Golden Amber Highlight)
            if ((ev.triggerType === 'math' || ev.triggerType === 'date' || ev.triggerType === 'duration' || ev.triggerType === 'timezone') && ev.result !== undefined && ev.result !== null) {
              const label =
                ev.triggerType === 'date' ? 'DATE' :
                ev.triggerType === 'duration' ? 'DURATION' :
                ev.triggerType === 'timezone' ? 'TIME' : '=';
              return (
                <div 
                  key={idx}
                  className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border shadow-sm"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.18)',
                    borderColor: 'rgba(245, 158, 11, 0.45)',
                    color: '#FDE68A'
                  }}
                >
                  <span className="opacity-80 text-[10px] text-amber-400">{label}:</span>
                  <span className="font-extrabold">{ev.result}</span>
                </div>
              );
            }

            // Variable badge (Vibrant Cyan Highlight)
            if (ev.triggerType === 'variable') {
              return (
                <div 
                  key={idx}
                  className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono border font-semibold shadow-sm"
                  style={{
                    backgroundColor: 'rgba(56, 189, 248, 0.16)',
                    borderColor: 'rgba(56, 189, 248, 0.4)',
                    color: '#BAE6FD'
                  }}
                >
                  <span className="text-[#38BDF8]">{ev.varName}:</span>
                  <span className="font-bold text-amber-300">{ev.result}</span>
                </div>
              );
            }

            // Reminder badge (Vibrant Indigo & Gold Highlight)
            if (ev.triggerType === 'reminder' && ev.reminderData) {
              const rem = ev.reminderData;
              const isUrgent = rem.isToday || rem.isPastDue;
              return (
                <div 
                  key={idx}
                  className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold border shadow-sm transition-all ${
                    isUrgent
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse'
                      : 'bg-indigo-500/18 border-indigo-500/45 text-indigo-200'
                  }`}
                  title={`Scheduled for ${rem.targetDateStr} (${rem.relativeStr})`}
                >
                  <Bell className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-[10px] uppercase opacity-80">{rem.dayLabel}:</span>
                  <span className="font-extrabold">{rem.title}</span>
                  <span className="text-[10px] opacity-70 font-normal">({rem.timeLabel})</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* 
        BOTTOM TOOLBAR
        Clean, non-wrapping toolbar with dedicated controls and resize grip.
      */}
      <div 
        className="h-[44px] px-3 flex items-center justify-between border-t shrink-0"
        style={{
          backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.05)',
          borderColor: theme.border
        }}
      >
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* New Note */}
          <button
            onClick={onNewNote}
            title={`New Scratch Card (${isMac ? '⌘N' : 'Ctrl+N'})`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-sm"
            style={{
              backgroundColor: theme.badgeBg,
              color: theme.accent
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Delete Note */}
          <button
            onClick={onDeleteNote}
            title={`Delete Card (${isMac ? '⌘D' : 'Ctrl+D'})`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: theme.textMuted
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Copy */}
          <button
            onClick={handleCopy}
            title={`Copy Note Text (${isMac ? '⌘C' : 'Ctrl+C'})`}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: copied ? '#10B981' : theme.textMuted
            }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Insert Checklist Button */}
          <button
            onClick={handleInsertChecklist}
            title="Insert Task / Checklist (- [ ])"
            className="flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono transition-colors whitespace-nowrap"
            style={{
              backgroundColor: theme.isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
              color: theme.textMuted
            }}
          >
            <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>+ Task</span>
          </button>
        </div>

        {/* Center: Keyboard Hint or Live Word Counter (Tot feature) */}
        {settings.showWordCounter ? (
          <div 
            className="text-[10px] font-mono tracking-wider whitespace-nowrap shrink-0 opacity-80 px-2 font-medium"
            style={{ color: theme.accent }}
            title="Live Word & Character Count"
          >
            {wordCount}w · {charCount}c
          </div>
        ) : (
          <div 
            className="text-[10px] font-mono tracking-wider whitespace-nowrap shrink-0 opacity-60 px-2"
            style={{ color: theme.textMuted }}
          >
            {isMac ? '⌘1–5 SWITCH' : 'Ctrl+1–5 SWITCH'}
          </div>
        )}

        {/* Right side: Branding & Drag Handle */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span 
            className="flex items-center space-x-1 font-mono text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap"
            style={{
              backgroundColor: theme.badgeBg,
              borderColor: theme.border,
              color: theme.accent
            }}
          >
            <img src={logoUrl} alt="PaperTape" className="w-3.5 h-3.5 rounded-sm object-cover" />
            <span>papertape</span>
          </span>

          {/* Corner Resize Grip */}
          <div
            onMouseDown={handleResizeMouseDown}
            title="Drag to resize scratchpad downwards"
            className="w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 opacity-40 hover:opacity-100 transition-opacity"
            style={{ color: theme.text }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="8.5" cy="8.5" r="1" />
              <circle cx="4.5" cy="8.5" r="1" />
              <circle cx="8.5" cy="4.5" r="1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Lightbox for full screenshot view */}
      {lightboxImage && (
        <div 
          className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 shadow-lg transition-transform hover:scale-105"
            >
              <X className="w-4 h-4" />
            </button>
            <img 
              src={lightboxImage} 
              alt="Screenshot full preview" 
              className="max-w-full max-h-[75vh] object-contain rounded-lg border border-white/20 shadow-2xl" 
            />
            <div className="mt-2 text-[11px] font-mono text-white/70">
              Click anywhere to close
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
