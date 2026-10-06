import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, CheckSquare, Square, Image as ImageIcon, X } from 'lucide-react';
import { Note, AppSettings, Attachment } from '../types';
import { ThemeColors } from '../constants/themes';
import { evaluateNoteContent, LineEvaluation } from '../services/engine';

interface NoteEditorProps {
  note: Note;
  settings: AppSettings;
  theme: ThemeColors;
  onUpdateContent: (newContent: string) => void;
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (attachmentId: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  settings,
  theme,
  onUpdateContent,
  onAddAttachment,
  onRemoveAttachment
}) => {
  const [evaluations, setEvaluations] = useState<LineEvaluation[]>([]);
  const [activeTimers, setActiveTimers] = useState<Record<number, { seconds: number; isRunning: boolean }>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-evaluate on content changes
  useEffect(() => {
    const evals = evaluateNoteContent(note.content);
    setEvaluations(evals);

    // Initialize timers for any new timer triggers
    evals.forEach((ev, idx) => {
      if (ev.triggerType === 'timer' && ev.timerData && !activeTimers[idx]) {
        setActiveTimers(prev => ({
          ...prev,
          [idx]: {
            seconds: ev.timerData!.seconds,
            isRunning: false
          }
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
              // Countdown or pomo
              if (t.seconds > 0) {
                next[k] = { ...t, seconds: t.seconds - 1 };
              } else {
                next[k] = { ...t, isRunning: false };
                // Play notification beep if sound enabled
                if (settings.soundEffects) {
                  try {
                    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                    const osc = ctx.createOscillator();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.3);
                  } catch {}
                }
              }
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [evaluations, settings.soundEffects]);

  const toggleChecklist = (lineIdx: number) => {
    const lines = note.content.split('\n');
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const line = lines[lineIdx];
      let updatedLine = line;
      if (line.trim().endsWith('/x') || line.trim().endsWith('/X')) {
        // Uncheck: remove /x
        updatedLine = line.replace(/\/x$/i, '').trimEnd();
      } else if (line.trim().startsWith('- [x]')) {
        updatedLine = line.replace(/^- \[x\]/i, '- [ ]');
      } else if (line.trim().startsWith('- [ ]')) {
        updatedLine = line.replace(/^- \[ \]/i, '- [x]');
      } else {
        // Check: add /x
        updatedLine = `${line.trimEnd()} /x`;
      }
      lines[lineIdx] = updatedLine;
      onUpdateContent(lines.join('\n'));
    }
  };

  const toggleTimer = (idx: number) => {
    setActiveTimers(prev => {
      const current = prev[idx] || { seconds: evaluations[idx]?.timerData?.seconds || 0, isRunning: false };
      return {
        ...prev,
        [idx]: { ...current, isRunning: !current.isRunning }
      };
    });
  };

  const resetTimer = (idx: number) => {
    setActiveTimers(prev => {
      const initial = evaluations[idx]?.timerData?.initialSeconds || 0;
      return {
        ...prev,
        [idx]: { seconds: initial, isRunning: false }
      };
    });
  };

  const formatTimerSeconds = (total: number) => {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Drag and drop screenshot handler
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onAddAttachment({
            id: `att_${Date.now()}`,
            name: file.name,
            type: file.type,
            dataUrl: reader.result as string,
            createdAt: Date.now()
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Clipboard paste screenshot handler
  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const file = e.clipboardData.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          onAddAttachment({
            id: `att_${Date.now()}`,
            name: file.name || 'Pasted Screenshot',
            type: file.type,
            dataUrl: reader.result as string,
            createdAt: Date.now()
          });
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const paperClass = 
    settings.paperType === 'dots' ? 'paper-dots' :
    settings.paperType === 'lines' ? 'paper-lines' : 'paper-blank';

  return (
    <div 
      className={`relative flex-1 flex flex-col overflow-hidden film-grain ${paperClass}`}
      style={{
        backgroundColor: theme.paperBg,
        color: theme.text,
        '--dot-color': theme.dotColor,
        '--line-color': theme.lineColor
      } as any}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-yellow-400">
          <ImageIcon className="w-8 h-8 text-yellow-400 mb-2 animate-bounce" />
          <span className="text-sm font-mono text-white">Drop screenshot or image here</span>
        </div>
      )}

      {/* Attachments Carousel (Screenshots) */}
      {note.attachments && note.attachments.length > 0 && (
        <div className="px-4 pt-3 flex space-x-2 overflow-x-auto pb-1 border-b border-black/5 dark:border-white/5">
          {note.attachments.map(att => (
            <div key={att.id} className="relative group shrink-0 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 shadow-sm">
              <img src={att.dataUrl} alt={att.name} className="h-20 w-auto object-cover max-w-[160px]" />
              <button 
                onClick={() => onRemoveAttachment(att.id)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor & Reactive Margin Container */}
      <div className="flex-1 flex overflow-y-auto px-4 py-3 relative">
        <textarea
          ref={textareaRef}
          value={note.content}
          onChange={(e) => onUpdateContent(e.target.value)}
          onPaste={handlePaste}
          placeholder="Start typing your scratchpad... (e.g. rate: $85, hours: 40, rate * hours = or sum, timer 5, /x)"
          className="w-full h-full bg-transparent resize-none outline-none font-sans text-[13.5px] leading-relaxed z-10"
          style={{ 
            color: theme.text,
            caretColor: theme.accent,
            lineHeight: settings.paperType === 'lines' ? '28px' : '1.7'
          }}
          autoFocus
        />
      </div>

      {/* Reactive Calculation & Trigger Badges Overlay */}
      {evaluations.some(e => e.isTrigger) && (
        <div 
          className="px-4 py-2 border-t flex flex-wrap gap-2 items-center bg-black/5 dark:bg-white/5 backdrop-blur-sm z-20"
          style={{ borderColor: theme.border }}
        >
          {evaluations.map((ev, idx) => {
            if (!ev.isTrigger) return null;

            // Checklist Pill
            if (ev.triggerType === 'checklist') {
              return (
                <button
                  key={idx}
                  onClick={() => toggleChecklist(idx)}
                  className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono transition-all border ${
                    ev.isChecked ? 'line-through opacity-50 bg-black/5' : 'bg-black/10 dark:bg-white/10 hover:border-accent'
                  }`}
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  {ev.isChecked ? <CheckSquare className="w-3 h-3 text-green-500" /> : <Square className="w-3 h-3 opacity-60" />}
                  <span className="truncate max-w-[140px]">{ev.cleanText || 'Task'}</span>
                </button>
              );
            }

            // Timer Pill
            if (ev.triggerType === 'timer' && ev.timerData) {
              const timerState = activeTimers[idx] || { seconds: ev.timerData.seconds, isRunning: false };
              return (
                <div 
                  key={idx}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-mono border"
                  style={{ 
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.accent,
                    color: theme.accent
                  }}
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

            // Math / Sum / Avg / Count / Date / Duration / Time badge
            if (ev.result !== undefined && ev.result !== null && ev.result !== '') {
              const label = 
                ev.triggerType === 'sum' ? 'TOTAL' :
                ev.triggerType === 'avg' ? 'AVG' :
                ev.triggerType === 'count' ? 'COUNT' :
                ev.triggerType === 'date' ? 'DATE' :
                ev.triggerType === 'duration' ? 'DURATION' :
                ev.triggerType === 'timezone' ? 'TIME' : '=';

              return (
                <div 
                  key={idx}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium shadow-sm border"
                  style={{
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.accent,
                    color: theme.accent
                  }}
                >
                  <span className="opacity-70 text-[9px]">{label}:</span>
                  <span className="font-bold">{ev.result}</span>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
};
