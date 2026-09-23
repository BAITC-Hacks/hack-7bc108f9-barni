import logging
import os
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.ai import router as ai_router
from app.api.meta import router as meta_router
from app.api.rating import router as rating_router
from app.api.tasks import router as tasks_router

logger = logging.getLogger(__name__)

app = FastAPI(title="Business tasks MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-AI-Fallback"],
)


def error_response(status: int, code: str, message: str, **extra) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, **extra}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
            headers=exc.headers,
        )
    phrase = HTTPStatus(exc.status_code).phrase
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": phrase.upper().replace(" ", "_").replace("-", "_"),
                "message": exc.detail if isinstance(exc.detail, str) else phrase,
            }
        },
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(part) for part in first.get("loc", ()) if part != "body")
    message = "Некорректные данные запроса"
    if field:
        message += f": {field} — {first.get('msg', '')}"
    return error_response(422, "VALIDATION_ERROR", message)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return error_response(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера")


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(ai_router)
app.include_router(meta_router)
app.include_router(tasks_router)
app.include_router(rating_router)
