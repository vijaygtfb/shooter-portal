"""Create DynamoDB Local tables. Keep in sync with template-backend.yaml (ItemsTable)."""

import boto3

from app.core.config import get_settings


def main() -> None:
    s = get_settings()
    ddb = boto3.client("dynamodb", region_name=s.aws_region, endpoint_url=s.dynamodb_endpoint_url)
    existing = ddb.list_tables()["TableNames"]
    if s.items_table_name in existing:
        print(f"Table {s.items_table_name} already exists")
        return
    ddb.create_table(
        TableName=s.items_table_name,
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
    print(f"Created table {s.items_table_name}")


if __name__ == "__main__":
    main()
