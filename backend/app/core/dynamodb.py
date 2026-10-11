"""DynamoDB resource factory. The only place boto3 DynamoDB clients are created."""

from functools import lru_cache

import boto3

from app.core.config import get_settings


@lru_cache
def get_dynamodb_resource():
    settings = get_settings()
    return boto3.resource(
        "dynamodb",
        region_name=settings.aws_region,
        endpoint_url=settings.dynamodb_endpoint_url or None,
    )
