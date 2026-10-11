"""Invoke the real Lambda entry point with an API Gateway HTTP API (v2) event."""

import json
from types import SimpleNamespace


def _http_api_event(method: str, path: str) -> dict:
    return {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "example.execute-api.ap-south-1.amazonaws.com"},
        "requestContext": {
            "http": {
                "method": method,
                "path": path,
                "sourceIp": "127.0.0.1",
                "protocol": "HTTP/1.1",
            },
            "stage": "$default",
        },
        "isBase64Encoded": False,
    }


def test_handler_health(client):
    from app.main import handler

    ctx = SimpleNamespace(aws_request_id="req-123")
    resp = handler(_http_api_event("GET", "/health"), ctx)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["status"] == "ok"
    assert resp["headers"]["x-request-id"] == "req-123"
