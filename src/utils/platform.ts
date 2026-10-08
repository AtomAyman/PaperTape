export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

export const modSymbol = isMac ? '⌘' : 'Ctrl';
export const altSymbol = isMac ? '⌥' : 'Alt';
export const shiftSymbol = isMac ? '⇧' : 'Shift';

export const screenshotKeyLabel = isMac ? '⌥⇧S' : 'PrtScn';
export const screenshotKeyHint = isMac ? '⌥⇧S' : 'PrtScn / Alt+Shift+S';

export function formatKeyCombination(macCombo: string): string {
  if (isMac) return macCombo;
  return macCombo
    .replace(/⌘⇧/g, 'Ctrl+Shift+')
    .replace(/⌘/g, 'Ctrl+')
    .replace(/⌥⇧/g, 'Alt+Shift+')
    .replace(/⌥/g, 'Alt+')
    .replace(/⇧/g, 'Shift+');
}
