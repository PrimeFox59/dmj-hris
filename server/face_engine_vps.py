#!/usr/bin/env python3
"""
Prime ProjectX - Native Enterprise Biometric Face Recognition Engine
Powered by OpenCV YuNet (Deep Face Detector) & SFace (Deep Face Recognizer 128D)
High-Concurrency Multi-Threaded Edition
Port: 8599
"""

import os
import sys
import json
import time
import base64
import threading
import numpy as np
import cv2
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

BASE_DIR = '/home/Prime-Projectx/face_models'
YUNET_PATH = os.path.join(BASE_DIR, 'face_detection_yunet_2023mar.onnx')
SFACE_PATH = os.path.join(BASE_DIR, 'face_recognition_sface_2021dec.onnx')
GALLERY_FILE = os.path.join(BASE_DIR, 'enrolled_gallery.json')

print("[FACE ENGINE] Loading YuNet & SFace models...")
# Initialize SFace Recognizer
recognizer = cv2.FaceRecognizerSF.create(model=SFACE_PATH, config="")

# In-Memory Gallery: { employee_id: { "name": str, "features": [np.ndarray, ...] } }
gallery = {}
gallery_lock = threading.Lock()

def get_detector(width, height):
    return cv2.FaceDetectorYN.create(
        model=YUNET_PATH,
        config="",
        input_size=(width, height),
        score_threshold=0.6,
        nms_threshold=0.3,
        top_k=5000
    )

def decode_image_base64(b64_str):
    if ',' in b64_str:
        b64_str = b64_str.split(',', 1)[1]
    img_bytes = base64.b64decode(b64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

def detect_and_extract(img):
    """Detects primary face, checks occlusions, aligns, and extracts 128D SFace feature."""
    h, w, _ = img.shape
    detector = get_detector(w, h)
    _, faces = detector.detect(img)
    
    if faces is None or len(faces) == 0:
        return None, "NO_FACE", "Posisikan wajah di dalam frame kamera"
    
    face = faces[0]
    box = face[0:4]
    conf = float(face[-1])
    
    # Check minimum confidence
    if conf < 0.65:
        return None, "LOW_CONFIDENCE", "Wajah kurang jelas — Dekatkan ke kamera"
    
    # Occlusion check: 5 landmarks (Right Eye, Left Eye, Nose, Right Mouth, Left Mouth)
    landmarks = face[4:14].reshape((5, 2))
    r_eye, l_eye, nose, r_mouth, l_mouth = landmarks
    
    # Distance checks: Eye distance vs Mouth distance vs Nose position
    eye_dist = np.linalg.norm(r_eye - l_eye)
    mouth_dist = np.linalg.norm(r_mouth - l_mouth)
    box_w = box[2]
    box_h = box[3]
    
    # Hand covering face detection:
    if eye_dist < box_w * 0.18 or mouth_dist < box_w * 0.10:
        return None, "OCCLUDED", "⚠️ Wajah terhalang tangan / masker! Harap perlihatkan seluruh wajah."

    # Eye contrast checks in original image (detects hands/sunglasses/objects covering eyes)
    for eye_pt, name in [(r_eye.astype(int), "Mata Kanan"), (l_eye.astype(int), "Mata Kiri")]:
        ex, ey = eye_pt
        patch = img[max(0, ey-10):min(h, ey+10), max(0, ex-10):min(w, ex+10)]
        if patch.size > 0:
            diff = int(np.max(patch)) - int(np.min(patch))
            if diff < 30:
                return None, "OCCLUDED", f"⚠️ {name} terhalang tangan / objek! Harap perlihatkan seluruh wajah."
    
    # Align standardized 112x112 face crop
    aligned_face = recognizer.alignCrop(img, face)

    # High-precision Anti-Occlusion & Facial Zone Integrity Check
    gray = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
    r_eye_var = cv2.Laplacian(gray[25:50, 20:50], cv2.CV_64F).var()
    l_eye_var = cv2.Laplacian(gray[25:50, 62:92], cv2.CV_64F).var()
    nose_var = cv2.Laplacian(gray[48:70, 42:70], cv2.CV_64F).var()
    mouth_crop = gray[70:95, 32:80]
    mouth_var = cv2.Laplacian(mouth_crop, cv2.CV_64F).var()
    sobel_y_mouth = float(np.var(cv2.Sobel(mouth_crop, cv2.CV_64F, 0, 1)))

    if r_eye_var < 20 or l_eye_var < 20:
        return None, "OCCLUDED", "⚠️ Mata terhalang tangan / objek! Harap perlihatkan seluruh wajah."
    if mouth_var < 20 or sobel_y_mouth < 35:
        return None, "OCCLUDED", "⚠️ Mulut terhalang tangan / masker! Harap perlihatkan seluruh wajah."
    if nose_var < 15:
        return None, "OCCLUDED", "⚠️ Hidung terhalang tangan / masker! Harap perlihatkan seluruh wajah."

    feature = recognizer.feature(aligned_face)
    return feature, "OK", "Wajah terdeteksi"

def save_gallery_to_disk():
    with gallery_lock:
        data = {}
        for emp_id, info in gallery.items():
            data[emp_id] = {
                "name": info["name"],
                "features": [f.tolist() if isinstance(f, np.ndarray) else f for f in info["features"]]
            }
        with open(GALLERY_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"[FACE ENGINE] Gallery saved to disk: {len(gallery)} employees.")

def load_gallery_from_disk():
    global gallery
    if not os.path.exists(GALLERY_FILE):
        return
    try:
        with open(GALLERY_FILE, 'r') as f:
            data = json.load(f)
        with gallery_lock:
            gallery = {}
            for emp_id, info in data.items():
                gallery[emp_id] = {
                    "name": info["name"],
                    "features": [np.array(f, dtype=np.float32) for f in info["features"]]
                }
        print(f"[FACE ENGINE] Loaded {len(gallery)} employees from {GALLERY_FILE}")
    except Exception as e:
        print(f"[FACE ENGINE] Error loading gallery: {e}")

load_gallery_from_disk()

class FaceEngineHandler(BaseHTTPRequestHandler):
    timeout = 10

    def _send_json(self, status_code, data):
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            self.wfile.write(json.dumps(data).encode('utf-8'))
        except Exception:
            pass

    def do_OPTIONS(self):
        self._send_json(200, {"ok": True})

    def do_GET(self):
        if self.path == '/health':
            with gallery_lock:
                emps = [
                    {"id": k, "name": v["name"], "samples_count": len(v["features"])}
                    for k, v in gallery.items()
                ]
            self._send_json(200, {
                "status": "online",
                "engine": "OpenCV YuNet + SFace 128D Multi-Threaded",
                "enrolled_employees": len(emps),
                "employees": emps
            })
        elif self.path == '/reload':
            load_gallery_from_disk()
            self._send_json(200, {"success": True, "enrolled_employees": len(gallery)})
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 25 * 1024 * 1024:
            self._send_json(413, {"error": "Payload too large"})
            return

        try:
            post_data = self.rfile.read(content_length)
            body = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self._send_json(400, {"error": f"Invalid JSON: {e}"})
            return

        # ROUTE: /verify (1:N Facial Recognition)
        if self.path == '/verify':
            img_b64 = body.get('image')
            if not img_b64:
                self._send_json(400, {"error": "image base64 required"})
                return

            t0 = time.time()
            try:
                img = decode_image_base64(img_b64)
            except Exception as e:
                self._send_json(400, {"error": f"Failed to decode image: {e}"})
                return

            if img is None:
                self._send_json(400, {"error": "Could not decode image buffer"})
                return

            feat, status, msg = detect_and_extract(img)
            proc_time_ms = round((time.time() - t0) * 1000, 2)

            if feat is None:
                self._send_json(200, {
                    "matched": False,
                    "status": status,
                    "score": 0,
                    "message": msg,
                    "proc_time_ms": proc_time_ms
                })
                return

            # Compare against all enrolled employees with Multi-Candidate Margin Analysis
            best_emp_id = None
            best_emp_name = None
            best_sim = -1.0
            second_emp_id = None
            second_emp_name = None
            second_sim = -1.0

            with gallery_lock:
                gallery_copy = {k: {"name": v["name"], "features": list(v["features"])} for k, v in gallery.items()}

            # Per-employee maximum similarity tracker
            emp_best_scores = []
            for emp_id, info in gallery_copy.items():
                emp_max_sim = -1.0
                for enrolled_feat in info["features"]:
                    sim = float(recognizer.match(feat, enrolled_feat, cv2.FaceRecognizerSF_FR_COSINE))
                    if sim > emp_max_sim:
                        emp_max_sim = sim
                if emp_max_sim > -1.0:
                    emp_best_scores.append((emp_id, info["name"], emp_max_sim))

            # Sort descending by similarity
            emp_best_scores.sort(key=lambda x: x[2], reverse=True)

            if len(emp_best_scores) > 0:
                best_emp_id, best_emp_name, best_sim = emp_best_scores[0]
            if len(emp_best_scores) > 1:
                second_emp_id, second_emp_name, second_sim = emp_best_scores[1]

            confidence_margin = (best_sim - second_sim) if (len(emp_best_scores) > 1) else 1.0

            # Calibrated SFace Score Curve (Threshold >= 0.52 and Margin >= 0.08)
            MATCH_THRESHOLD = 0.52
            MIN_MARGIN = 0.08

            score = 0
            if best_sim >= 0.70:
                score = round(92 + ((best_sim - 0.70) / 0.30) * 8)
            elif best_sim >= 0.58:
                score = round(80 + ((best_sim - 0.58) / 0.12) * 12)
            elif best_sim >= MATCH_THRESHOLD:
                score = round(70 + ((best_sim - MATCH_THRESHOLD) / (0.58 - MATCH_THRESHOLD)) * 10)
            elif best_sim >= 0.40:
                score = round(45 + ((best_sim - 0.40) / (MATCH_THRESHOLD - 0.40)) * 24)
            else:
                score = max(0, round(best_sim * 100))
            score = max(0, min(100, score))

            is_ambiguous = (best_sim >= MATCH_THRESHOLD) and (confidenceMargin if 'confidenceMargin' in locals() else confidence_margin < MIN_MARGIN) and (len(emp_best_scores) > 1)
            is_matched = (best_sim >= MATCH_THRESHOLD) and not is_ambiguous and (best_emp_id is not None)

            if is_ambiguous:
                self._send_json(200, {
                    "matched": False,
                    "status": "AMBIGUOUS",
                    "employeeId": best_emp_id,
                    "employeeName": best_emp_name,
                    "secondEmployeeId": second_emp_id,
                    "secondEmployeeName": second_emp_name,
                    "cosine_similarity": round(best_sim, 4),
                    "second_similarity": round(second_sim, 4),
                    "confidence_margin": round(confidence_margin, 4),
                    "score": score,
                    "message": f"⚠️ Kemiripan ambigu ({best_emp_name} vs {second_emp_name}). Harap ketuk nama Anda.",
                    "proc_time_ms": proc_time_ms
                })
            elif is_matched:
                self._send_json(200, {
                    "matched": True,
                    "status": "MATCHED",
                    "employeeId": best_emp_id,
                    "employeeName": best_emp_name,
                    "cosine_similarity": round(best_sim, 4),
                    "second_similarity": round(second_sim, 4) if second_sim > -1 else 0.0,
                    "confidence_margin": round(confidence_margin, 4),
                    "score": score,
                    "message": f"✅ Wajah Terverifikasi: {best_emp_name} ({score}%)",
                    "proc_time_ms": proc_time_ms
                })
            else:
                target_name = best_emp_name if best_emp_name else "Karyawan Terdaftar"
                self._send_json(200, {
                    "matched": False,
                    "status": "DENIED",
                    "employeeId": best_emp_id,
                    "employeeName": best_emp_name,
                    "cosine_similarity": round(best_sim, 4),
                    "confidence_margin": round(confidence_margin, 4),
                    "score": score,
                    "message": f"⚠️ Wajah Tidak Dikenali / Bukan {target_name} ({score}%)",
                    "proc_time_ms": proc_time_ms
                })

        # ROUTE: /enroll
        elif self.path == '/enroll':
            emp_id = body.get('employeeId')
            emp_name = body.get('name')
            images = body.get('images', [])
            if isinstance(body.get('image'), str):
                images.append(body.get('image'))

            if not emp_id or not emp_name or len(images) == 0:
                self._send_json(400, {"error": "employeeId, name, and images required"})
                return

            new_features = []
            for b64 in images:
                try:
                    img = decode_image_base64(b64)
                    if img is not None:
                        feat, status, msg = detect_and_extract(img)
                        if feat is not None:
                            new_features.append(feat)
                except Exception as e:
                    print(f"[ENROLL ERROR] {e}")

            if len(new_features) > 0:
                with gallery_lock:
                    if emp_id not in gallery:
                        gallery[emp_id] = {"name": emp_name, "features": []}
                    gallery[emp_id]["features"].extend(new_features)
                save_gallery_to_disk()

            self._send_json(200, {
                "success": len(new_features) > 0,
                "employeeId": emp_id,
                "enrolled_samples": len(new_features),
                "message": f"Berhasil mendaftarkan {len(new_features)} sampel wajah untuk {emp_name}"
            })
        else:
            self._send_json(404, {"error": "Route Not Found"})

class ThreadedFaceServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

if __name__ == '__main__':
    port = 8599
    server = ThreadedFaceServer(('0.0.0.0', port), FaceEngineHandler)
    print(f"🚀 [FACE ENGINE] Native Multi-Threaded Server running on http://0.0.0.0:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
