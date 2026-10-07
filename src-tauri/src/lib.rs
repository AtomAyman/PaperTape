use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_notification::NotificationExt;

#[derive(Default)]
pub struct AppState {
    pub is_pinned: AtomicBool,
    pub auto_clipboard: AtomicBool,
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

#[derive(Debug, serde::Deserialize)]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
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

fn get_papertape_dir() -> PathBuf {
    let base_dir = dirs::document_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Documents")))
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base_dir.join("PaperTape");
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::create_dir_all(dir.join("screenshots"));
    dir
}

fn position_below_tray(win: &WebviewWindow, tray_rect: &tauri::Rect) {
    let Ok(scale) = win.scale_factor() else { return };
    let current_size = win.outer_size().unwrap_or(tauri::PhysicalSize::new(
        (780.0 * scale) as u32,
        (560.0 * scale) as u32,
    ));
    let win_w = current_size.width as f64;

    let (tray_x, tray_y) = match tray_rect.position {
        tauri::Position::Physical(p) => (p.x as f64, p.y as f64),
        tauri::Position::Logical(l) => (l.x * scale, l.y * scale),
    };
    let (tray_w, tray_h) = match tray_rect.size {
        tauri::Size::Physical(s) => (s.width as f64, s.height as f64),
        tauri::Size::Logical(s) => (s.width * scale, s.height * scale),
    };

    let tray_center_x = tray_x + (tray_w / 2.0);
    let target_x = tray_center_x - (win_w / 2.0);
    let target_y = tray_y + tray_h + (4.0 * scale);

    let clamped_x = if let Ok(Some(monitor)) = win.current_monitor().or_else(|_| win.primary_monitor()) {
        let m_pos = monitor.position();
        let m_size = monitor.size();
        let min_x = m_pos.x as f64 + (10.0 * scale);
        let max_x = (m_pos.x + m_size.width as i32) as f64 - win_w - (10.0 * scale);
        target_x.max(min_x).min(max_x)
    } else {
        target_x
    };

    let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
        clamped_x as i32,
        target_y as i32,
    )));
}

fn position_at_top_right(win: &WebviewWindow) {
    let Ok(scale) = win.scale_factor() else { return };
    let current_size = win.outer_size().unwrap_or(tauri::PhysicalSize::new(
        (780.0 * scale) as u32,
        (560.0 * scale) as u32,
    ));
    let win_w = current_size.width as f64;

    if let Ok(Some(monitor)) = win.current_monitor().or_else(|_| win.primary_monitor()) {
        let m_pos = monitor.position();
        let m_size = monitor.size();
        let target_x = (m_pos.x + m_size.width as i32) as f64 - win_w - (30.0 * scale);
        let target_y = m_pos.y as f64 + (32.0 * scale);
        let _ = win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(
            target_x as i32,
            target_y as i32,
        )));
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
fn resize_window(app: AppHandle, size: WindowSize) -> Result<(), String> {
    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.set_size(tauri::LogicalSize::new(size.width, size.height));
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
fn cancel_crop(app: AppHandle) -> Result<(), String> {
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.destroy();
    }
    if let Some(main_win) = app.get_webview_window("main") {
        position_at_top_right(&main_win);
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn confirm_crop(app: AppHandle, payload: ConfirmCropPayload) -> Result<(), String> {
    // Destroy crop overlay window before capture so it doesn't appear in the image
    if let Some(crop_win) = app.get_webview_window("crop-overlay") {
        let _ = crop_win.destroy();
    }

    // Allow window server a brief moment to clear the overlay
    #[cfg(target_os = "macos")]
    std::thread::sleep(Duration::from_millis(80));

    let dir = get_papertape_dir();
    let screenshots_dir = dir.join("screenshots");
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
        let (x, y, w, h) = if let Some(ref r) = payload.rect {
            (r.x as i32, r.y as i32, r.width as i32, r.height as i32)
        } else {
            (0, 0, 1920, 1080)
        };
        let ps_cmd = format!(
            "Add-Type -AssemblyName System.Drawing; \
             $bmp = New-Object System.Drawing.Bitmap({}, {}); \
             $g = [System.Drawing.Graphics]::FromImage($bmp); \
             $g.CopyFromScreen({}, {}, 0, 0, $bmp.Size); \
             $bmp.Save('{}', [System.Drawing.Imaging.ImageFormat]::Png); \
             $g.Dispose(); $bmp.Dispose();",
            w, h, x, y, file_path.to_string_lossy().replace('\\', "\\\\")
        );
        let status = std::process::Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(&ps_cmd)
            .status()
            .map_err(|e| format!("PowerShell screen capture failed: {}", e))?;
        if !status.success() {
            return Err("Screen capture failed on Windows".to_string());
        }
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

    // Emit event to main window and re-show it
    let timestamp = now.format("%I:%M %p").to_string();
    let shot_event = serde_json::json!({
        "filePath": file_path.to_string_lossy().to_string(),
        "dataUrl": data_url,
        "timestamp": timestamp
    });

    if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.emit("screenshot-captured", shot_event);
        position_at_top_right(&main_win);
        let _ = main_win.show();
        let _ = main_win.set_focus();
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
                #[cfg(target_os = "windows")]
                {
                    let _ = window_vibrancy::apply_acrylic(&main_win, Some((20, 20, 25, 220)));
                }

                // Auto-hide when clicking away unless pinned
                let win_clone = main_win.clone();
                let state_clone = Arc::clone(&app_state);
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(focused) = event {
                        if !*focused && !state_clone.is_pinned.load(Ordering::SeqCst) {
                            let _ = win_clone.hide();
                        }
                    }
                });
            }

            // Register default global shortcuts
            let app_for_toggle = app_handle.clone();
            let _ = app.global_shortcut().on_shortcut("Alt+A", move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    if let Some(win) = app_for_toggle.get_webview_window("main") {
                        if win.is_visible().unwrap_or(false) {
                            let _ = win.hide();
                        } else {
                            position_at_top_right(&win);
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                }
            });

            let app_for_crop = app_handle.clone();
            let _ = app.global_shortcut().on_shortcut("Alt+Shift+S", move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = capture_screenshot(app_for_crop.clone());
                }
            });

            // Setup Tray Icon
            let toggle_item = MenuItem::with_id(app, "toggle", "Toggle PaperTape", true, None::<&str>)?;
            let crop_item = MenuItem::with_id(app, "crop", "Interactive Screenshot", true, None::<&str>)?;
            let vault_item = MenuItem::with_id(app, "vault", "Open Documents Folder", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit PaperTape", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&toggle_item, &crop_item, &vault_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                position_at_top_right(&win);
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
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
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.hide();
                            } else {
                                position_below_tray(&win, &rect);
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
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
