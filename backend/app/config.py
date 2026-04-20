"""Central configuration: all env vars in one place."""
import os
from dotenv import load_dotenv

load_dotenv()

# Auth
SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Database
DATABASE_PATH: str = os.getenv("DATABASE_PATH", "./data/app.db")

# ChromaDB
CHROMA_PATH: str = os.getenv("CHROMA_PATH", "./data/chroma")

# Uploads
UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./data/uploads")
SUBMISSION_DIR: str = os.getenv("SUBMISSION_DIR", "./data/uploads/submissions")

# Email / SMTP
SMTP_HOST: str = os.getenv("SMTP_HOST", "")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "课程智能助教")

# ASR (Speech-to-Text)
ASR_API_KEY: str = os.getenv("ASR_API_KEY", "")
ASR_BASE_URL: str = os.getenv("ASR_BASE_URL", "https://api.siliconflow.cn/v1")
ASR_MODEL: str = os.getenv("ASR_MODEL", "TeleAI/TeleSpeechASR")
