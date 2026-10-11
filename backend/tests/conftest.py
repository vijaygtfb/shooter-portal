import os

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

# Set env BEFORE importing the app so Settings picks these up
os.environ.update(
    {
        "APP_ENV": "local",
        "LOG_LEVEL": "DEBUG",
        "LOG_FORMAT": "text",
        "AWS_REGION": "ap-south-1",
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "ITEMS_TABLE_NAME": "test-items",
        "CORS_ORIGINS": "http://localhost:5173",
    }
)
os.environ.pop("DYNAMODB_ENDPOINT_URL", None)

from app.core.config import get_settings  # noqa: E402
from app.core.dynamodb import get_dynamodb_resource  # noqa: E402


@pytest.fixture
def client():
    get_settings.cache_clear()
    get_dynamodb_resource.cache_clear()
    with mock_aws():
        boto3.client("dynamodb", region_name="ap-south-1").create_table(
            TableName="test-items",
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "id", "AttributeType": "S"},
                {"AttributeName": "category", "AttributeType": "S"},
                {"AttributeName": "created_at", "AttributeType": "S"},
            ],
            KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "category-index",
                    "KeySchema": [
                        {"AttributeName": "category", "KeyType": "HASH"},
                        {"AttributeName": "created_at", "KeyType": "RANGE"},
                    ],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
        )
        from app.main import app

        with TestClient(app) as c:
            yield c
    get_dynamodb_resource.cache_clear()
