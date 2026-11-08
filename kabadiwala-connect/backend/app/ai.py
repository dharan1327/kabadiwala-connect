"""Scrap image classification interface.

No model is bundled. Set CLASSIFIER_MODEL_PATH to a trained Keras model whose output
order matches CLASS_NAMES. Without a model the endpoint reports "unavailable" and the
user chooses the category manually. Predictions are never fabricated.
"""
from typing import Optional

from .config import settings

CLASS_NAMES = [
    "paper", "cardboard", "plastic", "mixed_plastics", "iron", "aluminium", "copper", "glass",
    "circuit_boards", "cables", "batteries", "screens", "motors", "other",
]
_model = None
_load_error: Optional[str] = None


def _load():
    global _model, _load_error
    if _model is not None or _load_error is not None:
        return _model
    if not settings.classifier_model_path:
        _load_error = "No classifier model is configured. Please choose the category manually."
        return None
    try:
        import tensorflow as tf  # optional dependency

        _model = tf.keras.models.load_model(settings.classifier_model_path)
    except Exception as exc:  # noqa: BLE001
        _load_error = f"The classifier could not be loaded ({exc.__class__.__name__}). Please choose the category manually."
    return _model


def classify(image_path: str) -> dict:
    model = _load()
    if model is None:
        return {"status": "unavailable", "category": None, "confidence": None, "message": _load_error}
    try:
        import numpy as np
        from PIL import Image

        with Image.open(image_path) as img:
            arr = np.asarray(img.convert("RGB").resize((224, 224)), dtype="float32") / 255.0
        probs = model.predict(arr[None, ...], verbose=0)[0]
        if len(probs) != len(CLASS_NAMES):
            raise ValueError("Model output does not match CLASS_NAMES")
        idx = int(np.argmax(probs))
        return {
            "status": "ok",
            "category": CLASS_NAMES[idx],
            "confidence": round(float(probs[idx]), 3),
            "message": "Suggestion only. Please confirm or correct the category.",
        }
    except Exception:  # noqa: BLE001
        return {"status": "error", "category": None, "confidence": None,
                "message": "The photograph could not be classified. Please choose the category manually."}
