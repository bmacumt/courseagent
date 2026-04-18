"""Configuration loaded from environment variables."""
import os

from dotenv import load_dotenv

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-secret-change-me")
DATABASE_PATH: str = os.getenv("DATABASE_PATH", "./data/auth.db")
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
