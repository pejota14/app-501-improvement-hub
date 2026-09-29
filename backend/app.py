import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers.improvements import router as improvements_router
from .schemas import HealthResponse

FRONTEND_ORIGINS = [
    "http://localhost:4200",
    "http://127.0.0.1:4200",
]


def create_app() -> FastAPI:
    origins = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", ",".join(FRONTEND_ORIGINS)).split(",")
        if origin.strip()
    ]
    application = FastAPI(
        title="Improvement Hub API",
        description="Receives and records structured improvement proposals.",
        version="1.0.0",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )

    @application.get("/health", response_model=HealthResponse, tags=["Health"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok")

    application.include_router(improvements_router)
    return application


app = create_app()
