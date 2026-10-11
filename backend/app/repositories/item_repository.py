"""Data access for the Items table. Routes never call boto3 directly."""

from datetime import UTC, datetime
from uuid import uuid4

from boto3.dynamodb.conditions import Key

from app.core.config import get_settings
from app.core.dynamodb import get_dynamodb_resource
from app.core.logging import get_logger
from app.models.item import Category, Item, ItemCreate

logger = get_logger(__name__)

CATEGORY_INDEX = "category-index"


class ItemRepository:
    def __init__(self, table) -> None:
        self._table = table

    def create(self, data: ItemCreate) -> Item:
        item = Item(id=str(uuid4()), created_at=datetime.now(UTC), **data.model_dump())
        self._table.put_item(
            Item=item.model_dump(mode="json", exclude_none=True),
            ConditionExpression="attribute_not_exists(id)",
        )
        logger.info("item created", extra={"item_id": item.id})
        return item

    def get(self, item_id: str) -> Item | None:
        resp = self._table.get_item(Key={"id": item_id})
        raw = resp.get("Item")
        return Item.model_validate(raw) if raw else None

    def list_by_category(self, category: Category, limit: int = 50) -> list[Item]:
        # Query on a GSI - never Scan in request paths
        resp = self._table.query(
            IndexName=CATEGORY_INDEX,
            KeyConditionExpression=Key("category").eq(category.value),
            ScanIndexForward=False,
            Limit=limit,
        )
        return [Item.model_validate(r) for r in resp.get("Items", [])]


def get_item_repository() -> ItemRepository:
    """FastAPI dependency - override in tests with app.dependency_overrides."""
    table = get_dynamodb_resource().Table(get_settings().items_table_name)
    return ItemRepository(table)
