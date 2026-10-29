from PIL import Image
import numpy as np

# Let's take live_attendance_photo.jpg (which is Galih)
live_img = Image.open('live_attendance_photo.jpg')

# In live_attendance_photo, Galih's face is centered at (70, 270, 360, 610) -> size 290x340
# Let's crop a 480x480 square centered on Galih's head in live_attendance_photo
# Center of head: cx = 215, cy = 440
# Box size: 400
box = 400
sx = max(0, 215 - box//2)
sy = max(0, 440 - box//2)
galih_head_square = live_img.crop((sx, sy, sx+box, sy+box)).resize((480, 480), Image.Resampling.BILINEAR)
galih_head_square.save('galih_enrolled_square.jpg')

print("Created galih_enrolled_square.jpg")
