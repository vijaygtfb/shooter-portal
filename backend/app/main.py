"""FastAPI app + Lambda entry point (app.main.handler)."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from app.api.routes import health, items
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger, request_id_ctx
from app.core.middleware import RequestLoggingMiddleware

settings = get_settings()
configure_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)

app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    docs_url=None if settings.is_prod else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_prod else "/openapi.json",
)

# CORS is handled here (not in API Gateway) so local and cloud behave the same
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Request-Id"],
)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id_ctx.get()},
    )


app.include_router(health.router)
app.include_router(items.router)

# Lambda entry point
handler = Mangum(app, lifespan="off")
