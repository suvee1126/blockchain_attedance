import os
import json
import base64
import cv2
import numpy as np
from typing import Tuple, Optional, Dict, Any

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models_weights")
YUNET_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")

_detector = None
_recognizer = None

def get_face_models():
    global _detector, _recognizer
    if _detector is None:
        if not os.path.exists(YUNET_PATH):
            raise FileNotFoundError(f"YuNet model missing at {YUNET_PATH}")
        _detector = cv2.FaceDetectorYN_create(YUNET_PATH, "", (320, 320))
    if _recognizer is None:
        if not os.path.exists(SFACE_PATH):
            raise FileNotFoundError(f"SFace model missing at {SFACE_PATH}")
        _recognizer = cv2.FaceRecognizerSF_create(SFACE_PATH, "")
    return _detector, _recognizer

def decode_base64_image(image_data: str) -> np.ndarray:
    """Decodes data:image/...;base64,... string into OpenCV BGR image"""
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    img_bytes = base64.b64decode(image_data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Failed to decode image from base64 buffer")
    return img

def encode_image_to_base64(img: np.ndarray, quality: int = 85) -> str:
    """Encodes OpenCV image to data:image/jpeg;base64,... data URL"""
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    _, buffer = cv2.imencode('.jpg', img, encode_param)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{b64_str}"

def extract_face_biometric(image_data: str) -> Dict[str, Any]:
    """
    Detects face in image, aligns it, extracts 128-dim SFace feature embedding,
    and creates a clean thumbnail.
    """
    try:
        img = decode_base64_image(image_data)
    except Exception as e:
        return {"success": False, "error": f"Invalid image format: {str(e)}"}

    detector, recognizer = get_face_models()
    h, w = img.shape[:2]
    detector.setInputSize((w, h))

    _, faces = detector.detect(img)
    if faces is None or len(faces) == 0:
        return {
            "success": False,
            "error": "No human face detected. Please ensure your face is well-lit and centered in the frame."
        }

    # Select the largest face by area if multiple faces detected
    best_face = max(faces, key=lambda f: f[2] * f[3])
    x, y, fw, fh = int(best_face[0]), int(best_face[1]), int(best_face[2]), int(best_face[3])

    # Crop thumbnail with margin
    pad_x = int(fw * 0.15)
    pad_y = int(fh * 0.15)
    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(w, x + fw + pad_x)
    y2 = min(h, y + fh + pad_y)
    thumbnail = img[y1:y2, x1:x2]

    # Align & Crop using OpenCV SFace canonical landmark standard
    aligned_face = recognizer.alignCrop(img, best_face)
    feature = recognizer.feature(aligned_face) # shape (1, 128) float32
    feature_list = feature.flatten().tolist()

    # Generate thumbnail
    thumb_b64 = encode_image_to_base64(thumbnail)

    return {
        "success": True,
        "featureVector": feature_list,
        "thumbnail": thumb_b64,
        "faceBox": {"x": x, "y": y, "width": fw, "height": fh},
        "confidence": float(best_face[-1])
    }

def compare_faces(stored_feature_list: list, live_image_data: str, threshold: float = 0.40) -> Dict[str, Any]:
    """
    Compares live face from camera against enrolled student feature embedding using Cosine Similarity.
    Official SFace threshold is 0.363; we use 0.40 for strict anti-spoofing accuracy.
    """
    if not stored_feature_list or len(stored_feature_list) != 128:
        return {
            "verified": False,
            "score": 0.0,
            "error": "Student has no registered face biometric in the system. Admin must enroll the face first."
        }

    live_res = extract_face_biometric(live_image_data)
    if not live_res["success"]:
        return {
            "verified": False,
            "score": 0.0,
            "error": live_res["error"]
        }

    _, recognizer = get_face_models()
    feat_stored = np.array(stored_feature_list, dtype=np.float32).reshape(1, 128)
    feat_live = np.array(live_res["featureVector"], dtype=np.float32).reshape(1, 128)

    cosine_score = float(recognizer.match(feat_stored, feat_live, cv2.FaceRecognizerSF_FR_COSINE))

    # Convert score to an intuitive percentage (0 to 100%)
    match_pct = max(0.0, min(100.0, (cosine_score / 0.70) * 100.0))

    is_match = cosine_score >= threshold

    return {
        "verified": is_match,
        "cosineScore": round(cosine_score, 4),
        "similarityPercentage": round(match_pct, 1),
        "threshold": threshold,
        "liveThumbnail": live_res["thumbnail"],
        "error": None if is_match else f"Face mismatch. Similarity score ({round(match_pct, 1)}%) below required verification threshold."
    }

