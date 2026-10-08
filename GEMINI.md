# Project Instructions & Guidelines

## 1. Upfront Intake Checklist
When starting or fundamentally refactoring a desktop application, menu bar utility, or system tray widget, present the 6-question Intake Checklist before writing code:
1. **Form Factor**: Menu bar flyout (drops down/pops up, auto-hides on blur), floating HUD, or standard window?
2. **Target OS**: macOS only, Windows only, or Cross-platform?
3. **Sizing & Memory**: Ideal default dimensions (e.g. 420×500) and persistent resize memory across launches.
4. **Shortcuts & Keys**: Global shortcuts, OS modifier conventions, and dedicated hardware keys (`PrintScreen` on Windows).
5. **Aesthetics & Transparency**: Frameless rounded corners, zero halo guidelines (no Windows acrylic over transparent rounded windows, no box-shadow bleed).
6. **Repository & CI/CD**: Commit and push to GitHub, automated DMG/NSIS releases via GitHub Actions.

## 2. Windows & macOS Tray Positioning Formula
- On macOS: Pop DOWN below menu bar (`tray_y + tray_h + 8px`).
- On Windows: Pop UP above taskbar tray (`tray_y - win_h - 8px`).
- Horizontal alignment: Anchor outer right edge near the tray icon so expanding/widening grows inward into open desktop space without shifting away from the icon.

## 3. The "Zero Halo" Rule
- Never use OS acrylic/vibrancy (`apply_acrylic`) on Windows transparent frameless windows with rounded corners.
- Configure `transparent: true`, `decorations: false`, `shadow: false` in Tauri config.
- Avoid outer `shadow-2xl` on root containers that bleed outside rounded borders.

## 4. WebView2 Transparent Hit-Testing
- In Windows WebView2, 100% transparent backgrounds (`background-color: transparent`) drop mouse clicks through to background apps. Always use `rgba(0,0,0,0.005)` for overlay backdrops.

## 5. Git Discipline
- The GitHub remote repository is the single source of truth. All code, version bumps, and configuration changes must be committed and pushed directly to GitHub.
