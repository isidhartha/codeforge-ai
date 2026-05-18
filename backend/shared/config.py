"""Application configuration via environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # AI
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    ai_model: str = "gpt-4o"
    ai_stream: bool = True
    max_tokens: int = 4096

    # Redis
    redis_url: str = "redis://localhost:6379"

    # IDE
    workspace_dir: str = "/workspace"
    terminal_allowed_commands: str = "ls,pwd,cat,echo,python,node,npm,git,pip"

    # Server
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:3000,http://localhost:8080"

    # Security
    secret_key: str = "change-me-in-production"

    @property
    def allowed_commands(self) -> list[str]:
        return [c.strip() for c in self.terminal_allowed_commands.split(",")]

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
