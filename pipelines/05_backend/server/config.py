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

# Pipeline paths (relative to this file)
PIPELINES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAG_PATH = os.path.join(PIPELINES_DIR, "03_rag")
GRADING_PATH = os.path.join(PIPELINES_DIR, "04_grading")
