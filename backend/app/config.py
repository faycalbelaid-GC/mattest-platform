from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    app_env: str = "development"
    debug: bool = True

    database_url: str = "postgresql+asyncpg://mattest:mattest_secure_2024@localhost:5432/mattest_db"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "dev-secret-key-change-in-production-at-least-32-chars"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = '["http://localhost:3000","http://localhost:5173"]'

    mlflow_tracking_uri: str = "http://localhost:5000"
    reports_dir: str = "./reports"
    ml_models_dir: str = "./ml_models"

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.cors_origins)

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
