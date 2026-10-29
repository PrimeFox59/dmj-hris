from PIL import Image
import numpy as np

# Load enrolled images
samples = {
    'EMP-001 Galih': Image.open('sample_EMP-001.jpg'),
    'EMP-022 Selvi': Image.open('sample_EMP-022.jpg'),
    'EMP-030 Pepo': Image.open('sample_EMP-030.jpg'),
    'EMP-160 Wahyuning': Image.open('sample_EMP-160.jpg'),
}

live_img = Image.open('live_attendance_photo.jpg')
print(f"Live image: {live_img.size}, format: {live_img.format}")

# Function 1: Enrolled patch (biometricHelper.ts: extractFeaturePatch)
# Resizes whole img to 32x32, converts to grayscale luma: 0.299 R + 0.587 G + 0.114 B
def extract_feature_patch(img):
    img_rgb = img.convert('RGB').resize((32, 32), Image.Resampling.BILINEAR)
    arr = np.array(img_rgb, dtype=np.float64)
    luma = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]) / 255.0
    return luma.flatten()

# Function 2: extractLiveFaceCandidates (biometricHelper.ts: extractLiveFaceCandidates)
def extract_live_candidates(img):
    sw, sh = img.size
    target_aspect = 3.0 / 4.0
    if sw / sh > target_aspect:
        visible_w = sh * target_aspect
        visible_x = (sw - visible_w) / 2.0
        visible_h = sh
        visible_y = 0.0
    else:
        visible_h = sw / target_aspect
        visible_y = (sh - visible_h) / 2.0
        visible_w = sw
        visible_x = 0.0

    face_base_box = round(visible_w * 0.72)
    face_center_x = visible_x + (visible_w / 2.0)
    face_center_y = visible_y + (visible_h * 0.44)

    configs = [
        (1.0, 0.0),
        (0.85, 0.0),
        (1.15, 0.0),
        (1.0, -0.05)
    ]

    candidates = []
    for scale, y_offset in configs:
        box = max(48, round(face_base_box * scale))
        sx = max(0, min(sw - box, round(face_center_x - (box / 2.0))))
        sy = max(0, min(sh - box, round(face_center_y - (box / 2.0) + (visible_h * y_offset))))

        # Standard crop
        crop = img.crop((sx, sy, sx + box, sy + box)).resize((32, 32), Image.Resampling.BILINEAR)
        crop_rgb = np.array(crop.convert('RGB'), dtype=np.float64)
        luma = (0.299 * crop_rgb[:, :, 0] + 0.587 * crop_rgb[:, :, 1] + 0.114 * crop_rgb[:, :, 2]) / 255.0
        candidates.append(('scale_' + str(scale) + '_norm', luma.flatten()))

        # Mirrored crop
        crop_mirr = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        crop_mirr_rgb = np.array(crop_mirr.convert('RGB'), dtype=np.float64)
        luma_m = (0.299 * crop_mirr_rgb[:, :, 0] + 0.587 * crop_mirr_rgb[:, :, 1] + 0.114 * crop_mirr_rgb[:, :, 2]) / 255.0
        candidates.append(('scale_' + str(scale) + '_mirr', luma_m.flatten()))

    # Fallback crop
    fb_box = min(sw, sh)
    fb_sx = round((sw - fb_box) / 2.0)
    fb_sy = round((sh - fb_box) / 2.0)
    fb_crop = img.crop((fb_sx, fb_sy, fb_sx + fb_box, fb_sy + fb_box)).resize((32, 32), Image.Resampling.BILINEAR)
    fb_rgb = np.array(fb_crop.convert('RGB'), dtype=np.float64)
    fb_luma = (0.299 * fb_rgb[:, :, 0] + 0.587 * fb_rgb[:, :, 1] + 0.114 * fb_rgb[:, :, 2]) / 255.0
    candidates.append(('fallback_center', fb_luma.flatten()))

    return candidates

def compute_cosine_similarity(vec_a, vec_b):
    n = len(vec_a)
    mean_a = np.mean(vec_a)
    mean_b = np.mean(vec_b)

    a = vec_a - mean_a
    b = vec_b - mean_b

    num = np.sum(a * b)
    den = np.sqrt(np.sum(a * a) * np.sum(b * b))
    if den == 0:
        return 0.0, 0

    r = num / den
    if r <= 0.05:
        score = 0
    elif r < 0.22:
        ratio = (r - 0.05) / 0.17
        score = round(ratio * 45)
    else:
        match_ratio = (r - 0.22) / 0.28
        score = min(100, max(65, round(65 + match_ratio * 35)))
    return r, score

enrolled_patches = {name: extract_feature_patch(img) for name, img in samples.items()}
live_cands = extract_live_candidates(live_img)

print("\n=== MATCH RESULTS: LIVE CAMERA ATTENDANCE PHOTO vs ENROLLED GALLERY ===")
for emp_name, emp_patch in enrolled_patches.items():
    best_score = -1
    best_r = -1
    best_cand_name = ""
    for cand_name, cand_patch in live_cands:
        r, score = compute_cosine_similarity(cand_patch, emp_patch)
        if score > best_score:
            best_score = score
            best_r = r
            best_cand_name = cand_name
    print(f"{emp_name.ljust(20)}: Best Pearson r = {best_r:.4f}, Score = {best_score}% (via {best_cand_name})")
