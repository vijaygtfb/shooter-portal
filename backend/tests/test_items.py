VALID = {"name": "Milk", "category": "FOOD", "quantity": 3}


def test_create_and_get_item(client):
    created = client.post("/items", json=VALID)
    assert created.status_code == 201
    item_id = created.json()["id"]

    fetched = client.get(f"/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Milk"
    assert fetched.json()["quantity"] == 3


def test_list_by_category(client):
    client.post("/items", json=VALID)
    client.post("/items", json={**VALID, "name": "TV", "category": "ELECTRONICS"})
    resp = client.get("/items", params={"category": "FOOD"})
    assert resp.status_code == 200
    assert [i["name"] for i in resp.json()["items"]] == ["Milk"]


def test_validation_error(client):
    resp = client.post("/items", json={"name": "x", "category": "BAD", "quantity": -1})
    assert resp.status_code == 422


def test_unknown_field_rejected(client):
    resp = client.post("/items", json={**VALID, "hack": True})
    assert resp.status_code == 422


def test_not_found(client):
    assert client.get("/items/does-not-exist").status_code == 404


def test_lambda_handler_exists():
    from app.main import handler

    assert callable(handler)
