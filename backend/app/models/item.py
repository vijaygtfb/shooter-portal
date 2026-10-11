"""Pydantic models = API contract. Keep in sync with frontend/src/features/items/schema.ts."""

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Category(StrEnum):
    GENERAL = "GENERAL"
    FOOD = "FOOD"
    ELECTRONICS = "ELECTRONICS"


class ItemCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=2, max_length=100)
    category: Category
    quantity: int = Field(ge=0, le=100_000)
    description: str | None = Field(default=None, max_length=500)


class Item(ItemCreate):
    model_config = ConfigDict(extra="ignore")

    id: str
    created_at: datetime


class ItemList(BaseModel):
    items: list[Item]
