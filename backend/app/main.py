from fastapi import FastAPI

from app.api.ai import router

app = FastAPI(title="Business tasks AI MVP")
app.include_router(router)
