import os
from pathlib import Path

try:  # optional .env loading
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass


def _bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./kabadiwala.db")
    auth_mode: str = os.getenv("AUTH_MODE", "dev")
    firebase_project_id: str = os.getenv("FIREBASE_PROJECT_ID", "")
    firebase_credentials_path: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
    cors_origins: list[str] = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()
    ]
    upload_dir: str = os.getenv("UPLOAD_DIR", "./uploads")
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "5"))
    classifier_model_path: str = os.getenv("CLASSIFIER_MODEL_PATH", "")
    match_radius_km: float = float(os.getenv("MATCH_RADIUS_KM", "10"))
    seed_demo: bool = _bool("SEED_DEMO", "true")


settings = Settings()
