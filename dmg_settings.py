import os

base_dir = os.path.abspath(os.path.dirname(os.path.realpath('dmg_settings.py')))

volume_name = 'PaperTape'
format = 'UDZO'
size = None

app_path = os.path.join(base_dir, 'src-tauri/target/universal-apple-darwin/release/bundle/macos/PaperTape.app')
files = [app_path]

symlinks = {
    'Applications': '/Applications'
}

icon = os.path.join(base_dir, 'src-tauri/icons/icon.icns')
badge_icon = icon
hide = ['.VolumeIcon.icns']

icon_locations = {
    'PaperTape.app': (160, 200),
    'Applications': (480, 200)
}

background = os.path.join(base_dir, 'dmg_background.png')

show_status_bar = False
show_tab_view = False
show_toolbar = False
show_pathbar = False
show_sidebar = False

window_rect = ((200, 150), (640, 420))
default_view = 'icon-view'
icon_size = 120
text_size = 13
