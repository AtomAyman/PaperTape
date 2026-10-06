import { AppTheme, SlotConfig } from '../types';

export interface ThemeColors {
  id: AppTheme;
  name: string;
  bg: string;
  paperBg: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  badgeBg: string;
  dotColor: string;
  lineColor: string;
  isDark: boolean;
}

export const THEMES: Record<AppTheme, ThemeColors> = {
  A24: {
    id: 'A24',
    name: 'A24 Film Slate',
    bg: '#0E0E10',
    paperBg: '#151518',
    text: '#EDEDED',
    textMuted: '#8E8E93',
    border: '#2C2C30',
    accent: '#F59E0B',
    badgeBg: '#2A2415',
    dotColor: '#2C2C35',
    lineColor: '#232328',
    isDark: true
  },
  MuadDib: {
    id: 'MuadDib',
    name: "Muad'Dib Desert",
    bg: '#EFE7DA',
    paperBg: '#F7F2E9',
    text: '#2B2620',
    textMuted: '#786C5E',
    border: '#DFD5C4',
    accent: '#D9532F',
    badgeBg: '#F2DFD5',
    dotColor: '#D8CCA6',
    lineColor: '#E4D9C7',
    isDark: false
  },
  TokyoNeon: {
    id: 'TokyoNeon',
    name: 'Tokyo Cyberpunk',
    bg: '#0B0D14',
    paperBg: '#111420',
    text: '#F0F4FC',
    textMuted: '#76829D',
    border: '#232A3E',
    accent: '#00E5FF',
    badgeBg: '#092530',
    dotColor: '#242F4B',
    lineColor: '#1E253B',
    isDark: true
  },
  VintagePaper: {
    id: 'VintagePaper',
    name: 'Field Notes Cream',
    bg: '#ECE8DF',
    paperBg: '#FDFBF7',
    text: '#1F2429',
    textMuted: '#6B7280',
    border: '#DDD7CC',
    accent: '#2563EB',
    badgeBg: '#DBEAFE',
    dotColor: '#CCD2DE',
    lineColor: '#E2E6EE',
    isDark: false
  },
  ObsidianNoir: {
    id: 'ObsidianNoir',
    name: 'Obsidian OLED',
    bg: '#000000',
    paperBg: '#080808',
    text: '#FAFAFA',
    textMuted: '#737373',
    border: '#262626',
    accent: '#10B981',
    badgeBg: '#064E3B',
    dotColor: '#262626',
    lineColor: '#1A1A1A',
    isDark: true
  }
};

// 5 Default Clean Slots (Expandable)
export const DEFAULT_SLOTS: SlotConfig[] = [
  { index: 0, name: 'Page 1', color: '#EF4444' }, // Red
  { index: 1, name: 'Page 2', color: '#F97316' }, // Orange
  { index: 2, name: 'Page 3', color: '#EAB308' }, // Yellow
  { index: 3, name: 'Page 4', color: '#10B981' }, // Green
  { index: 4, name: 'Page 5', color: '#3B82F6' }  // Blue
];

export const EXTRA_SLOTS: SlotConfig[] = [
  { index: 5, name: 'Page 6', color: '#8B5CF6' }, // Purple
  { index: 6, name: 'Page 7', color: '#EC4899' }, // Pink
  { index: 7, name: 'Page 8', color: '#06B6D4' }, // Cyan
  { index: 8, name: 'Page 9', color: '#64748B' }  // Slate
];
