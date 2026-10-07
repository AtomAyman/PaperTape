import os

volume_name = 'PaperTape'
format = 'UDZO'
size = None

app_path = '/Users/aymansuh/.gemini/antigravity/scratch/papertape-tauri/src-tauri/target/universal-apple-darwin/release/bundle/macos/PaperTape.app'
files = [app_path]

symlinks = {
    'Applications': '/Applications'
}

icon = '/Users/aymansuh/.gemini/antigravity/scratch/papertape-tauri/src-tauri/icons/icon.icns'
badge_icon = '/Users/aymansuh/.gemini/antigravity/scratch/papertape-tauri/src-tauri/icons/icon.icns'
hide = ['.VolumeIcon.icns']

icon_locations = {
    'PaperTape.app': (160, 200),
    'Applications': (480, 200)
}

background = '/Users/aymansuh/.gemini/antigravity/scratch/papertape-tauri/dmg_background.png'

show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False

window_rect = ((200, 150), (640, 420))
default_view = 'icon-view'
icon_size = 120
text_size = 13
