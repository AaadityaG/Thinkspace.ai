from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Thinkspace.ai"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173"]

    # MongoDB
    MONGO_DB: str = ""
    MONGO_DB_NAME: str = "thinkspace"

    # Auth
    JWT_SECRET: str = ""
    JWT_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str = ""

    # AI (Google ADK / Gemini)
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    # Free-tier models exposed to the frontend picker (each has its own daily
    # quota bucket — switching models dodges per-model rate limits).
    FREE_MODELS: list[str] = [
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
        "gemini-pro-latest",
    ]

    class Config:
        env_file = ".env"


settings = Settings()
