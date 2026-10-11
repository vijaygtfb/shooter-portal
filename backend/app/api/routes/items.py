from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.item import Category, Item, ItemCreate, ItemList
from app.repositories.item_repository import ItemRepository, get_item_repository

router = APIRouter(prefix="/items", tags=["items"])


@router.post("", response_model=Item, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate, repo: ItemRepository = Depends(get_item_repository)) -> Item:
    return repo.create(payload)


@router.get("/{item_id}", response_model=Item)
def get_item(item_id: str, repo: ItemRepository = Depends(get_item_repository)) -> Item:
    item = repo.get(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("", response_model=ItemList)
def list_items(
    category: Category,
    limit: int = Query(default=50, ge=1, le=100),
    repo: ItemRepository = Depends(get_item_repository),
) -> ItemList:
    return ItemList(items=repo.list_by_category(category, limit))
