use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;

pub struct AppState {
    pub is_pinned: AtomicBool,
    pub auto_clipboard: AtomicBool,
    pub last_tray_rect: Mutex<Option<tauri::Rect>>,
    pub last_saved_size: Mutex<Option<SavedWindowSize>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            is_pinned: AtomicBool::new(false),
            auto_clipboard: AtomicBool::new(true),
            last_tray_rect: Mutex::new(None),
            last_saved_size: Mutex::new(None),
        }
    }
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct CropRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, serde::Deserialize)]
pub struct ConfirmCropPayload {
    pub rect: Option<CropRect>,
    #[serde(rename = "copyToClipboardOnly", default)]
    pub copy_to_clipboard_only: bool,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone, Copy)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

pub type SavedWindowSize = WindowSize;

fn get_papertape_dir() -> PathBuf {
    let base_dir = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Documents")))
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base_dir.join("PaperTape");
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::create_dir_all(dir.join("screenshots"));
    dir
}

fn load_saved_window_size() -> Option<SavedWindowSize> {
    let path = get_papertape_dir().join(".window_size.json");
    if path.exists() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(size) = serde_json::from_str::<SavedWindowSize>(&content) {
                if size.width >= 320.0 && size.height >= 360.0 {
                    return Some(size);
                }
            }
        }
    }
    None
}

fn save_window_size(size: SavedWindowSize) {
    let path = get_papertape_dir().join(".window_size.json");
    if let Ok(json) = serde_json::to_string_pretty(&size) {
        let _ = std::fs::write(path, json);
    }
}

#[derive(Debug, serde::Deserialize)]
pub struct MarkdownNoteData {
    pub title: String,
    pub content: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
}

#[derive(Debug, serde::Deserialize, serde::Serialize, Clone)]
pub struct ShortcutsPayload {
    #[serde(rename = "toggleHud", default)]
    pub toggle_hud: Option<String>,
    #[serde(rename = "interactiveCrop", default)]
    pub interactive_crop: Option<String>,
    #[serde(rename = "screenshotStream", default)]
    pub screenshot_stream: Option<String>,
    #[serde(rename = "clipboardStream", default)]
    pub clipboard_stream: Option<String>,
}

fn position_flyout(win: &WebviewWindow, maybe_tray_rect: Option<&tauri::Rect>) {
    let Ok(scale) = win.scale_factor() else { return };
    let (default_w, default_h) = if let Some(saved) = load_saved_window_size() {
        (saved.width * scale, saved.height * scale)
    } else {
        (420.0 * scale, 500.0 * scale)
    };

    let current_size = win.outer_size().unwrap_or(tauri::PhysicalSize::new(
        default_w as u32,
        default_h as u32,
    ));
    let win_w = current_size.width as f64;
    let win_h = current_size.height as f64;

    let monitor = win
        .current_monitor()
        .or_else(|_| win.primary_monitor())
        .ok()
        .flatten();

    let (mon_x, mon_y, mon_w, mon_h) = if let Some(ref m) = monitor {
        let p = m.position();
        let s = m.size();
        (p.x as f64, p.y as f64, s.width as f64, s.height as f64)
    } else {
        (0.0, 0.0, 1920.0 * scale, 1080.0 * scale)
    };

    let (target_x, target_y) = if let Some(tray_rect) = maybe_tray_rect {
        let (tray_x, tray_y) = match tray_rect.position {
            tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
            tauri::Position::Logical(l) => (l.x * scale, l.y * scale),
        };
        let (tray_w, tray_h) = match tray_rect.size {
            tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
            tauri::Size::Logical(s) => (s.width * scale, s.height * scale),
        };

        let tray_center_x = tray_x + (tray_w / 2.0);

        // If tray is on the right half of the monitor (standard Windows tray & macOS menu bar):
        // Anchor the right edge near the tray icon so expanding width grows to the left into open desktop space!
        let is_right_half = tray_center_x > (mon_x + (mon_w / 2.0));
        let tx = if is_right_half {
            let anchor_right = tray_center_x + (28.0 * scale);
            let max_right = mon_x + mon_w - (10.0 * scale);
            let target_right = anchor_right.min(max_right);
            target_right - win_w
        } else {
            tray_center_x - (win_w / 2.0)
        };

        // Detect taskbar location: is the tray in bottom half of monitor?
        let is_bottom_bar = tray_y > (mon_y + (mon_h / 2.0));
        let ty = if is_bottom_bar {
            // Standard Windows taskbar: pop UP directly above tray icon
            tray_y - win_h - (8.0 * scale)
        } else {
            // macOS menu bar or top taskbar: pop DOWN directly below tray icon
            tray_y + tray_h + (8.0 * scale)
        };

        (tx, ty)
    } else {
        #[cfg(target_os = "windows")]
        {
            // Windows default corner: bottom right right above the taskbar
            (
                mon_x + mon_w - win_w - (16.0 * scale),
                mon_y + mon_h - win_h - (60.0 * scale),
            )
        }
        #[cfg(not(target_os = "windows"))]
        {
            // macOS default corner: top right below menu bar
            (
                mon_x + mon_w - win_w - (24.0 * scale),
                mon_y + (32.0 * scale),
            )
        }
    };

    // Clamp coordinates safely within the active monitor bounds
    let margin = 10.0 * scale;
    let min_x = mon_x + margin;
    let max_x = (mon_x + mon_w - win_w - margin).max(min_x);
    let min_y = mon_y + margin;
    let max_y = (mon_y + mon_h - win_h - margin).max(min_y);

    let clamped_x = target_x.max(min_x).min(max_x);
    let clamped_y = target_y.max(min_y).min(max_y);

    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
        clamped_x as i32,
        clamped_y as i32,
    )));
}

fn show_main_window(win: &WebviewWindow, maybe_tray_rect: Option<&tauri::Rect>) {
    position_flyout(win, maybe_tray_rect);
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
}

fn toggle_main_window(win: &WebviewWindow, maybe_tray_rect: Option<&tauri::Rect>) {
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    } else {
        show_main_window(win, maybe_tray_rect);
    }
}

#[tauri::command]
fn toggle_pin(app: AppHandle, state: tauri::State<Arc<AppState>>) -> Result<bool, String> {
    let current = state.is_pinned.load(Ordering::SeqCst);
    let new_val = !current;
    state.is_pinned.store(new_val, Ordering::SeqCst);

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.set_always_on_top(new_val);
    }
    Ok(new_val)
}

#[tauri::command]
fn get_pin_state(state: tauri::State<Arc<AppState>>) -> bool {
    state.is_pinned.load(Ordering::SeqCst)
}

#[tauri::command]
fn resize_window(app: AppHandle, state: tauri::State<Arc<AppState>>, size: WindowSize) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.set_size(tauri::LogicalSize::new(size.width, size.height));
        let saved = SavedWindowSize {
            width: size.width,
            height: size.height,
        };
        if let Ok(mut lock) = state.last_saved_size.lock() {
            *lock = Some(saved);
        }
        save_window_size(saved);
    }
    Ok(())
}

#[tauri::command]
fn close_window(app: AppHandle) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn set_auto_clipboard(enabled: bool, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    state.auto_clipboard.store(enabled, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn save_markdown_note(note_data: MarkdownNoteData) -> Result<String, String> {
    let dir = get_papertape_dir();
    let safe_title = note_data
        .title
        .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "")
        .trim()
        .to_string();
    let file_name = if safe_title.is_empty() {
        "Untitled.md".to_string()
    } else {
        format!("{}.md", safe_title)
    };
    let file_path = dir.join(file_name);
    std::fs::write(&file_path, note_data.content)
        .map_err(|e| format!("Failed to write note: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn open_documents_folder() -> Result<(), String> {
    let dir = get_papertape_dir();
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer").arg(&dir).spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(&dir).spawn();
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&dir).spawn();
    }
    Ok(())
}

#[tauri::command]
fn save_vault_backup(notes: serde_json::Value) -> Result<(), String> {
    let dir = get_papertape_dir();
    let vault_path = dir.join(".papertape_vault.json");
    let temp_path = dir.join(".papertape_vault.json.tmp");
    let serialized = serde_json::to_string_pretty(&notes)
        .map_err(|e| format!("Serialization error: {}", e))?;
    std::fs::write(&temp_path, serialized)
        .map_err(|e| format!("Failed to write temp vault: {}", e))?;
    std::fs::rename(temp_path, vault_path)
        .map_err(|e| format!("Failed to commit vault: {}", e))?;
    Ok(())
}

#[tauri::command]
fn load_vault_backup() -> Result<serde_json::Value, String> {
    let dir = get_papertape_dir();
    let vault_path = dir.join(".papertape_vault.json");
    if !vault_path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let content = std::fs::read_to_string(vault_path)
        .map_err(|e| format!("Failed to read vault: {}", e))?;
    let notes: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse vault: {}", e))?;
    Ok(notes)
}

#[tauri::command]
fn send_system_notification(app: AppHandle, data: NotificationPayload) -> Result<(), String> {
    let _ = app
        .notification()
        .builder()
        .title(data.title)
        .body(data.body)
        .show();
    Ok(())
}

#[cfg(target_os = "windows")]
mod win32 {
    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct BitmapInfoHeader {
        pub bi_size: u32,
        pub bi_width: i32,
        pub bi_height: i32,
        pub bi_planes: u16,
        pub bi_bit_count: u16,
        pub bi_compression: u32,
        pub bi_size_image: u32,
        pub bi_x_pels_per_meter: i32,
        pub bi_y_pels_per_meter: i32,
        pub bi_clr_used: u32,
        pub bi_clr_important: u32,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct RgbQuad {
        pub rgb_blue: u8,
        pub rgb_green: u8,
        pub rgb_red: u8,
        pub rgb_reserved: u8,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct BitmapInfo {
        pub bmi_header: BitmapInfoHeader,
        pub bmi_colors: [RgbQuad; 1],
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    pub struct KbdllHookStruct {
        pub vk_code: u32,
        pub scan_code: u32,
        pub flags: u32,
        pub time: u32,
        pub dw_extra_info: usize,
    }

    pub const SRCCOPY: u32 = 0x00CC0020;
    pub const CAPTUREBLT: u32 = 0x40000000;
    pub const BI_RGB: u32 = 0;
    pub const DIB_RGB_COLORS: u32 = 0;
    pub const WH_KEYBOARD_LL: i32 = 13;
    pub const WM_KEYDOWN: u32 = 0x0100;
    pub const WM_SYSKEYDOWN: u32 = 0x0104;
    pub const VK_SNAPSHOT: u32 = 0x2C;

    #[link(name = "user32")]
    unsafe extern "system" {
        pub fn GetDC(hwnd: isize) -> isize;
        pub fn ReleaseDC(hwnd: isize, hdc: isize) -> i32;
        pub fn SetWindowsHookExW(
            idhook: i32,
            lpfn: Option<unsafe extern "system" fn(i32, usize, isize) -> isize>,
            hmod: isize,
            dwthreadid: u32,
        ) -> isize;
        pub fn UnhookWindowsHookEx(hhk: isize) -> i32;
        pub fn CallNextHookEx(hhk: isize, ncode: i32, wparam: usize, lparam: isize) -> isize;
        pub fn GetMessageW(lpmsg: *mut u8, hwnd: isize, wmsgfiltermin: u32, wmsgfiltermax: u32) -> i32;
        pub fn TranslateMessage(lpmsg: *const u8) -> i32;
        pub fn DispatchMessageW(lpmsg: *const u8) -> isize;
    }

    #[link(name = "gdi32")]
    unsafe extern "system" {
        pub fn CreateCompatibleDC(hdc: isize) -> isize;
        pub fn CreateCompatibleBitmap(hdc: isize, cx: i32, cy: i32) -> isize;
        pub fn SelectObject(hdc: isize, h: isize) -> isize;
        pub fn BitBlt(
            hdc: isize,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            hdcsrc: isize,
            x1: i32,
            y1: i32,
            rop: u32,
        ) -> i32;
        pub fn GetDIBits(
            hdc: isize,
            hbm: isize,
            start: u32,
            c_lines: u32,
            lpv_bits: *mut u8,
            lpbmi: *mut BitmapInfo,
            usage: u32,
        ) -> i32;
        pub fn DeleteObject(ho: isize) -> i32;
        pub fn DeleteDC(hdc: isize) -> i32;
    }
}

#[cfg(target_os = "windows")]
static GLOBAL_APP_HANDLE: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

#[cfg(target_os = "windows")]
unsafe extern "system" fn low_level_keyboard_proc(code: i32, wparam: usize, lparam: isize) -> isize {
    unsafe {
        if code >= 0 && (wparam as u32 == win32::WM_KEYDOWN || wparam as u32 == win32::WM_SYSKEYDOWN) {
            let kbd = *(lparam as *const win32::KbdllHookStruct);
            if kbd.vk_code == win32::VK_SNAPSHOT {
                if let Some(app) = GLOBAL_APP_HANDLE.get() {
                    let app_handle = app.clone();
                    std::thread::spawn(move || {
                        let _ = capture_screenshot(app_handle);
                    });
                }
                // Return 1 to swallow key so Windows Snipping Tool never activates!
                return 1;
            }
        }
        win32::CallNextHookEx(0, code, wparam, lparam)
    }
}

#[cfg(target_os = "windows")]
fn init_printscreen_hook(app: tauri::AppHandle) {
    let _ = GLOBAL_APP_HANDLE.set(app);
    std::thread::spawn(|| {
        unsafe {
            let hook = win32::SetWindowsHookExW(
                win32::WH_KEYBOARD_LL,
                Some(low_level_keyboard_proc),
                0,
                0,
            );
            if hook != 0 {
                let mut msg = [0u8; 48];
                while win32::GetMessageW(msg.as_mut_ptr(), 0, 0, 0) > 0 {
                    win32::TranslateMessage(msg.as_ptr());
                    win32::DispatchMessageW(msg.as_ptr());
                }
                win32::UnhookWindowsHookEx(hook);
            }
        }
    });
}

#[cfg(target_os = "windows")]
fn capture_screen_win32(x: i32, y: i32, w: u32, h: u32, file_path: &std::path::Path) -> Result<(), String> {
    unsafe {
        let hdc_screen = win32::GetDC(0);
        if hdc_screen == 0 {
            return Err("Failed to get desktop DC".to_string());
        }

        let hdc_mem = win32::CreateCompatibleDC(hdc_screen);
        if hdc_mem == 0 {
            win32::ReleaseDC(0, hdc_screen);
            return Err("Failed to create memory DC".to_string());
        }

        let hbitmap = win32::CreateCompatibleBitmap(hdc_screen, w as i32, h as i32);
        if hbitmap == 0 {
            win32::DeleteDC(hdc_mem);
            win32::ReleaseDC(0, hdc_screen);
            return Err("Failed to create compatible bitmap".to_string());
        }

        let old_bitmap = win32::SelectObject(hdc_mem, hbitmap);
        let rop = win32::SRCCOPY | win32::CAPTUREBLT;
        win32::BitBlt(hdc_mem, 0, 0, w as i32, h as i32, hdc_screen, x, y, rop);
        win32::SelectObject(hdc_mem, old_bitmap);

        let mut bmi: win32::BitmapInfo = std::mem::zeroed();
        bmi.bmi_header.bi_size = std::mem::size_of::<win32::BitmapInfoHeader>() as u32;
        bmi.bmi_header.bi_width = w as i32;
        bmi.bmi_header.bi_height = -(h as i32);
        bmi.bmi_header.bi_planes = 1;
        bmi.bmi_header.bi_bit_count = 32;
        bmi.bmi_header.bi_compression = win32::BI_RGB;

        let num_pixels = (w * h) as usize;
        let mut bgra_buf: Vec<u8> = vec![0u8; num_pixels * 4];

        let lines = win32::GetDIBits(
            hdc_mem,
            hbitmap,
            0,
            h,
            bgra_buf.as_mut_ptr(),
            &mut bmi,
            win32::DIB_RGB_COLORS,
        );

        win32::DeleteObject(hbitmap);
        win32::DeleteDC(hdc_mem);
        win32::ReleaseDC(0, hdc_screen);

        if lines == 0 {
            return Err("GetDIBits failed to copy pixels".to_string());
        }

        // Convert BGRA to RGBA in place
        for pixel in bgra_buf.chunks_exact_mut(4) {
            let b = pixel[0];
            let r = pixel[2];
            pixel[0] = r;
            pixel[2] = b;
            pixel[3] = 255;
        }

        if let Some(img) = image::RgbaImage::from_raw(w, h, bgra_buf) {
            img.save(file_path).map_err(|e| format!("PNG save failed: {}", e))?;
        } else {
            return Err("Failed to construct image from buffer".to_string());
        }

        Ok(())
    }
}

#[tauri::command]
fn capture_screenshot(app: AppHandle) -> Result<(), String> {
    // Hide main window so it is not visible during framing
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.hide();
    }

    let (pos, size) = if let Ok(Some(monitor)) = app.primary_monitor() {
        (
            tauri::Position::Physical(monitor.position().clone()),
            tauri::Size::Physical(monitor.size().clone()),
        )
    } else {
        (
            tauri::Position::Logical(tauri::LogicalPosition::new(0.0, 0.0)),
            tauri::Size::Logical(tauri::LogicalSize::new(1920.0, 1080.0)),
        )
    };

    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.set_position(pos);
        let _ = crop_win.set_size(size);
        let _ = crop_win.emit("reset-crop", ());
        let _ = crop_win.show();
        let _ = crop_win.set_focus();
    } else {
        let win = WebviewWindowBuilder::new(
            &app,
            "crop-overlay",
            WebviewUrl::App("index.html#crop".into()),
        )
        .title("PaperTape Crop Overlay")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .build();

        if let Ok(crop_win) = win {
            let _ = crop_win.set_position(pos);
            let _ = crop_win.set_size(size);
            let _ = crop_win.show();
            let _ = crop_win.set_focus();
        }
    }
    Ok(())
}

#[tauri::command]
fn cancel_crop(app: AppHandle, state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.hide();
    }
    if let Some(main_win) = app.get_webview_window("main") {
        let last_rect = state.last_tray_rect.lock().ok().and_then(|r| r.clone());
        show_main_window(&main_win, last_rect.as_ref());
    }
    Ok(())
}

#[tauri::command]
fn confirm_crop(app: AppHandle, state: tauri::State<Arc<AppState>>, payload: ConfirmCropPayload) -> Result<(), String> {
    // Hide crop overlay window immediately before capture so it does not appear in the image
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.hide();
    }

    // Allow window server a brief moment to clear the overlay
    std::thread::sleep(Duration::from_millis(40));

    let dir = get_papertape_dir();
    let screenshots_dir = dir.join("screenshots");
    let _ = std::fs::create_dir_all(&screenshots_dir);

    let now = chrono::Local::now();
    let filename = format!(
        "Screen Shot {} at {}.png",
        now.format("%Y-%m-%d"),
        now.format("%H.%M.%S")
    );
    let file_path = screenshots_dir.join(&filename);

    #[cfg(target_os = "macos")]
    {
        let mut cmd = std::process::Command::new("/usr/sbin/screencapture");
        cmd.arg("-x"); // silent

        if let Some(r) = payload.rect {
            cmd.arg(format!("-R{},{},{},{}", r.x as i32, r.y as i32, r.width as i32, r.height as i32));
        }
        cmd.arg(&file_path);

        let status = cmd.status().map_err(|e| format!("screencapture failed: {}", e))?;
        if !status.success() {
            return Err("screencapture exited with error".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        let scale = app
            .primary_monitor()
            .ok()
            .flatten()
            .map(|m| m.scale_factor())
            .unwrap_or(1.0);

        let (x, y, w, h) = if let Some(ref r) = payload.rect {
            (
                (r.x * scale).round() as i32,
                (r.y * scale).round() as i32,
                (r.width * scale).round().max(10.0) as u32,
                (r.height * scale).round().max(10.0) as u32,
            )
        } else {
            let (mw, mh) = app
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| (m.size().width, m.size().height))
                .unwrap_or((1920, 1080));
            (0, 0, mw, mh)
        };

        capture_screen_win32(x, y, w, h, &file_path)?;
    }

    if !file_path.exists() {
        return Err("Screenshot file not found".to_string());
    }

    let bytes = std::fs::read(&file_path).map_err(|e| format!("Failed to read screenshot: {}", e))?;
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:image/png;base64,{}", b64);

    if payload.copy_to_clipboard_only {
        if let Ok(img) = image::load_from_memory(&bytes) {
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            if let Ok(mut cb) = arboard::Clipboard::new() {
                let img_data = arboard::ImageData {
                    width: w as usize,
                    height: h as usize,
                    bytes: std::borrow::Cow::Borrowed(rgba.as_raw()),
                };
                let _ = cb.set_image(img_data);
            }
        }
    }

    // Emit event to main window and re-show it right at the tray position
    let timestamp_ms = now.timestamp_millis();
    let timestamp_str = now.format("%I:%M %p").to_string();
    let shot_event = serde_json::json!({
        "filePath": file_path.to_string_lossy().to_string(),
        "dataUrl": data_url,
        "filename": filename,
        "timestamp": timestamp_ms,
        "timeStr": timestamp_str,
        "createdAt": timestamp_ms
    });

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("screenshot-captured", shot_event);
        let last_rect = state.last_tray_rect.lock().ok().and_then(|r| r.clone());
        show_main_window(&main_win, last_rect.as_ref());
    }

    Ok(())
}

#[tauri::command]
fn copy_image_to_clipboard(data_url: String) -> Result<(), String> {
    let clean = if let Some(idx) = data_url.find(',') {
        &data_url[(idx + 1)..]
    } else {
        &data_url
    };

    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean.trim())
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let img = image::load_from_memory(&bytes).map_err(|e| format!("Image parse error: {}", e))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    let mut cb = arboard::Clipboard::new().map_err(|e| format!("Clipboard error: {}", e))?;
    let img_data = arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Borrowed(rgba.as_raw()),
    };
    cb.set_image(img_data).map_err(|e| format!("Set image error: {}", e))?;

    Ok(())
}

#[tauri::command]
fn update_shortcuts(shortcuts: ShortcutsPayload) -> Result<(), String> {
    let dir = get_papertape_dir();
    let shortcuts_path = dir.join(".papertape_shortcuts.json");

    let serialized = serde_json::to_string_pretty(&shortcuts)
        .map_err(|e| format!("Serialization error: {}", e))?;

    std::fs::write(&shortcuts_path, serialized)
        .map_err(|e| format!("Save shortcuts error: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState::default());
    let state_for_clipboard = Arc::clone(&app_state);

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::clone(&app_state))
        .setup(move |app| {
            let app_handle = app.handle().clone();

            if let Some(main_win) = app.get_webview_window("main") {
                // Restore saved size from previous session if present
                if let Some(saved) = load_saved_window_size() {
                    let _ = main_win.set_size(tauri::LogicalSize::new(saved.width, saved.height));
                }

                // Auto-hide when clicking away unless pinned, and persist user-resized dimensions
                let win_clone = main_win.clone();
                let state_clone = Arc::clone(&app_state);
                main_win.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Focused(focused) => {
                            if !*focused {
                                if let Ok(mut lock) = state_clone.last_saved_size.lock() {
                                    if let Some(size) = lock.take() {
                                        save_window_size(size);
                                    }
                                }
                                if !state_clone.is_pinned.load(Ordering::SeqCst) {
                                    let _ = win_clone.hide();
                                }
                            }
                        }
                        tauri::WindowEvent::Resized(physical_size) => {
                            if let Ok(scale) = win_clone.scale_factor() {
                                if scale > 0.0 {
                                    let logical_w = physical_size.width as f64 / scale;
                                    let logical_h = physical_size.height as f64 / scale;
                                    if logical_w >= 320.0 && logical_h >= 360.0 {
                                        let size = SavedWindowSize {
                                            width: logical_w.round(),
                                            height: logical_h.round(),
                                        };
                                        if let Ok(mut lock) = state_clone.last_saved_size.lock() {
                                            *lock = Some(size);
                                        }
                                        save_window_size(size);
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                });
            }

            // Register default global shortcuts
            let app_for_toggle = app_handle.clone();
            let state_for_toggle = Arc::clone(&app_state);
            let _ = app.global_shortcut().on_shortcut("Alt+A", move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(win) = app_for_toggle.get_webview_window("main") {
                        let last_rect = state_for_toggle.last_tray_rect.lock().ok().and_then(|r| r.clone());
                        toggle_main_window(&win, last_rect.as_ref());
                    }
                }
            });

            // Register PrintScreen (Windows hardware screen capture key)
            let app_for_prt = app_handle.clone();
            let _ = app.global_shortcut().on_shortcut("PrintScreen", move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = capture_screenshot(app_for_prt.clone());
                }
            });

            // Register Alt+Shift+S (cross-platform fallback)
            let app_for_crop = app_handle.clone();
            let _ = app.global_shortcut().on_shortcut("Alt+Shift+S", move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = capture_screenshot(app_for_crop.clone());
                }
            });

            #[cfg(target_os = "windows")]
            {
                init_printscreen_hook(app_handle.clone());
            }

            // Setup Tray Menu
            let toggle_item = MenuItem::with_id(app, "toggle", "Toggle PaperTape", true, None::<&str>)?;
            let crop_item = MenuItem::with_id(app, "crop", "Interactive Screenshot", true, None::<&str>)?;
            let vault_item = MenuItem::with_id(app, "vault", "Open Documents Folder", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit PaperTape", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&toggle_item, &crop_item, &vault_item, &quit_item])?;

            let state_for_menu = Arc::clone(&app_state);
            let state_for_tray = Arc::clone(&app_state);

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let last_rect = state_for_menu.last_tray_rect.lock().ok().and_then(|r| r.clone());
                            toggle_main_window(&win, last_rect.as_ref());
                        }
                    }
                    "crop" => {
                        let _ = capture_screenshot(app.clone());
                    }
                    "vault" => {
                        let _ = open_documents_folder();
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        if let Ok(mut lock) = state_for_tray.last_tray_rect.lock() {
                            *lock = Some(rect.clone());
                        }
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            toggle_main_window(&win, Some(&rect));
                        }
                    }
                })
                .build(app)?;

            // Background Clipboard Monitoring Thread
            let bg_app_handle = app_handle.clone();
            std::thread::spawn(move || {
                let mut last_clipboard_text = String::new();
                if let Ok(mut cb) = arboard::Clipboard::new() {
                    if let Ok(text) = cb.get_text() {
                        last_clipboard_text = text;
                    }
                }

                loop {
                    std::thread::sleep(Duration::from_millis(600));

                    if state_for_clipboard.auto_clipboard.load(Ordering::SeqCst) {
                        if let Ok(mut cb) = arboard::Clipboard::new() {
                            if let Ok(text) = cb.get_text() {
                                let trimmed = text.trim();
                                if !trimmed.is_empty() && trimmed != last_clipboard_text.trim() {
                                    last_clipboard_text = text.clone();
                                    let now = chrono::Local::now();
                                    let snippet = serde_json::json!({
                                        "id": format!("clip-{}", now.timestamp_millis()),
                                        "text": text,
                                        "timestamp": now.format("%I:%M %p").to_string()
                                    });

                                    if let Some(win) = bg_app_handle.get_webview_window("main") {
                                        let _ = win.emit("clipboard-snippet", snippet);
                                    }
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            toggle_pin,
            get_pin_state,
            resize_window,
            close_window,
            set_auto_clipboard,
            save_markdown_note,
            open_documents_folder,
            save_vault_backup,
            load_vault_backup,
            send_system_notification,
            capture_screenshot,
            confirm_crop,
            cancel_crop,
            copy_image_to_clipboard,
            update_shortcuts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
