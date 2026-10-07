import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Logical dimensions: 640 x 420
W_LOGICAL, H_LOGICAL = 640, 420
scale = 2
WIDTH, HEIGHT = W_LOGICAL * scale, H_LOGICAL * scale

img = Image.new('RGB', (WIDTH, HEIGHT), (168, 108, 64))
pixels = img.load()

# Seed for reproducible organic corkboard texture
random.seed(42)
base_r, base_g, base_b = 168, 108, 64

# Corkboard granular noise
for y in range(HEIGHT):
    for x in range(WIDTH):
        v = random.randint(-22, 22)
        if random.random() < 0.045:
            fleck = random.randint(-48, -26)
            pixels[x, y] = (max(0, base_r + fleck), max(0, base_g + fleck), max(0, base_b + fleck))
        elif random.random() < 0.035:
            fleck = random.randint(22, 42)
            pixels[x, y] = (min(255, base_r + fleck), min(255, base_g + fleck), min(255, base_b + fleck))
        else:
            pixels[x, y] = (max(0, min(255, base_r + v)), max(0, min(255, base_g + v)), max(0, min(255, base_b + v)))

# Organic cork softening
img = img.filter(ImageFilter.GaussianBlur(radius=0.75))

# Subtle border vignette for depth
vignette = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
v_draw = ImageDraw.Draw(vignette)
for i in range(35):
    alpha = int(2.8 * (35 - i))
    v_draw.rectangle([i * 2, i * 2, WIDTH - i * 2, HEIGHT - i * 2], outline=(50, 25, 8, alpha), width=3)
img = Image.alpha_composite(img.convert('RGBA'), vignette)

draw = ImageDraw.Draw(img)

# Typography
try:
    font_title = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 44)
    font_sub = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 22)
    font_instruction = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 24)
except Exception:
    try:
        font_title = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', 44)
        font_sub = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', 22)
        font_instruction = ImageFont.truetype('/System/Library/Fonts/HelveticaNeue.ttc', 24)
    except Exception:
        font_title = font_sub = font_instruction = ImageFont.load_default()

# Header: PaperTape
draw.text((WIDTH // 2 + 1, 71), "PaperTape", fill=(60, 30, 10, 200), font=font_title, anchor="mm")
draw.text((WIDTH // 2, 70), "PaperTape", fill=(255, 248, 235, 255), font=font_title, anchor="mm")

draw.text((WIDTH // 2, 115), "Universal macOS Edition", fill=(245, 220, 190, 220), font=font_sub, anchor="mm")

# Center Arrow between icons
arrow_y = 200 * scale # 400 px
start_x = 510
end_x = 770

arrow_shadow = (50, 25, 8, 160)
arrow_color = (255, 235, 195, 240)

draw.line([(start_x, arrow_y + 2), (end_x, arrow_y + 2)], fill=arrow_shadow, width=8)
draw.line([(start_x, arrow_y), (end_x, arrow_y)], fill=arrow_color, width=8)

head_len = 30
head_angle = math.radians(35)
head_pts_shadow = [
    (end_x, arrow_y + 2),
    (end_x - head_len * math.cos(head_angle), arrow_y + 2 - head_len * math.sin(head_angle)),
    (end_x - head_len * math.cos(head_angle) * 0.7, arrow_y + 2),
    (end_x - head_len * math.cos(head_angle), arrow_y + 2 + head_len * math.sin(head_angle)),
]
draw.polygon(head_pts_shadow, fill=arrow_shadow)

head_pts = [
    (end_x, arrow_y),
    (end_x - head_len * math.cos(head_angle), arrow_y - head_len * math.sin(head_angle)),
    (end_x - head_len * math.cos(head_angle) * 0.7, arrow_y),
    (end_x - head_len * math.cos(head_angle), arrow_y + head_len * math.sin(head_angle)),
]
draw.polygon(head_pts, fill=arrow_color)

# Footer instruction
draw.text((WIDTH // 2 + 1, 711), "Drag to Applications folder to install", fill=(60, 30, 10, 200), font=font_instruction, anchor="mm")
draw.text((WIDTH // 2, 710), "Drag to Applications folder to install", fill=(255, 240, 215, 230), font=font_instruction, anchor="mm")

base_dir = os.path.dirname(os.path.abspath(__file__))
output_2x = os.path.join(base_dir, "dmg_background@2x.png")
img.convert("RGB").save(output_2x, "PNG")

output_1x = os.path.join(base_dir, "dmg_background.png")
img_1x = img.resize((W_LOGICAL, H_LOGICAL), Image.Resampling.LANCZOS)
img_1x.convert("RGB").save(output_1x, "PNG")

print("Generated both 1x and @2x backgrounds successfully.")
