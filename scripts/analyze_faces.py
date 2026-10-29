from PIL import Image
import numpy as np

# In test_enrolled_front.png (480x480):
# Galih's head is located approximately at:
# x: 120 to 360, y: 80 to 380 (width ~240, height ~300)
# Let's crop tight face on test_enrolled_front.png
im_galih = Image.open('test_enrolled_front.png')
w, h = im_galih.size
print('Galih original enrolled size:', w, h)

# In live_attendance_photo.jpg (640x800):
# Galih's head is located at:
# x: 50 to 350, y: 250 to 650
im_live = Image.open('live_attendance_photo.jpg')
print('Live attendance size:', im_live.size)
