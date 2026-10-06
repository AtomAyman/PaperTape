import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export function setupTauriBridge() {
  if (typeof window === 'undefined') return;

  const tauriAPI = {
    togglePin: async (): Promise<boolean> => {
      return await invoke<boolean>('toggle_pin');
    },
    getPinState: async (): Promise<boolean> => {
      return await invoke<boolean>('get_pin_state');
    },
    resizeWindow: async (size: { width: number; height: number }): Promise<void> => {
      await invoke('resize_window', { size });
    },
    closeWindow: async (): Promise<void> => {
      await invoke('close_window');
    },
    setAutoClipboard: async (enabled: boolean): Promise<void> => {
      await invoke('set_auto_clipboard', { enabled });
    },
    onClipboardSnippet: (callback: (data: { id: string; text: string; timestamp: string }) => void) => {
      let unlisten: (() => void) | null = null;
      listen<{ id: string; text: string; timestamp: string }>('clipboard-snippet', (event) => {
        callback(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });
      return () => {
        if (unlisten) unlisten();
      };
    },
    saveMarkdownNote: async (noteData: { title: string; content: string }): Promise<string> => {
      return await invoke<string>('save_markdown_note', { noteData });
    },
    openDocumentsFolder: async (): Promise<void> => {
      await invoke('open_documents_folder');
    },
    captureScreenshot: async (): Promise<void> => {
      await invoke('capture_screenshot');
    },
    onScreenshotCaptured: (callback: (data: { filePath: string; dataUrl: string; timestamp: string }) => void) => {
      let unlisten: (() => void) | null = null;
      listen<{ filePath: string; dataUrl: string; timestamp: string }>('screenshot-captured', (event) => {
        callback(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });
      return () => {
        if (unlisten) unlisten();
      };
    },
    copyImageToClipboard: async (dataUrl: string): Promise<void> => {
      await invoke('copy_image_to_clipboard', { dataUrl });
    },
    saveVaultBackup: async (notes: any): Promise<void> => {
      await invoke('save_vault_backup', { notes });
    },
    loadVaultBackup: async (): Promise<any[]> => {
      return await invoke<any[]>('load_vault_backup');
    },
    sendNotification: async (data: { title: string; body: string }): Promise<void> => {
      await invoke('send_system_notification', { data });
    },
    isElectron: false,
    isTauri: true,

    updateShortcuts: async (shortcuts: any): Promise<void> => {
      await invoke('update_shortcuts', { shortcuts });
    },
    confirmCrop: async (rect: { x: number; y: number; width: number; height: number } | null, copyToClipboardOnly = false): Promise<void> => {
      await invoke('confirm_crop', { payload: { rect, copyToClipboardOnly } });
    },
    cancelCrop: async (): Promise<void> => {
      await invoke('cancel_crop');
    },
    onNavigateToStream: (callback: (streamType: 'clipboard' | 'screenshot') => void) => {
      let unlisten: (() => void) | null = null;
      listen<'clipboard' | 'screenshot'>('navigate-to-stream', (event) => {
        callback(event.payload);
      }).then((fn) => {
        unlisten = fn;
      });
      return () => {
        if (unlisten) unlisten();
      };
    }
  };

  (window as any).electronAPI = tauriAPI;
  (window as any).tauriAPI = tauriAPI;
}
