from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:123456@localhost:5432/cv_builder"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DASHSCOPE_API_KEY: str = ""
    QWEN_MODEL: str = "qwen-plus"  # qwen-turbo | qwen-plus | qwen-max
    UPLOAD_DIR: str = "uploads"
    GENERATED_DIR: str = "generated"
    # HuggingFace (optional — not used in current AI flow)
    HUGGINGFACE_API_KEY: str = ""
    HUGGINGFACE_MODEL: str = "mistralai/Mistral-7B-Instruct-v0.2"

    class Config:
        env_file = ".env"

settings = Settings()
