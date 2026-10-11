"""Application settings. All configuration comes from environment variables."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "myapp"
    app_env: Literal["local", "test", "uat", "prod"] = "local"

    # Logging - set per environment by the pipeline (env-*.yaml -> CloudFormation -> Lambda env)
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    log_format: Literal["json", "text"] = "json"

    aws_region: str = "ap-south-1"
    items_table_name: str = "myapp-local-items"
    dynamodb_endpoint_url: str | None = None  # set only for DynamoDB Local

    cors_origins: str = ""  # comma-separated

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.app_env == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()
