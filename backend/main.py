import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database.db import create_tables
from auth.routes.auth import router as auth_router
from parser.routes.parse import router as parser_router
from ai.routes.tailor import router as ai_router
from generator.routes.generate import router as generator_router
from storage.routes.files import router as storage_router
from config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.GENERATED_DIR, exist_ok=True)

app = FastAPI(title="CV Builder API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await create_tables()

app.include_router(auth_router,      prefix="/api/auth",      tags=["Auth"])
app.include_router(parser_router,    prefix="/api/parser",    tags=["Parser"])
app.include_router(ai_router,        prefix="/api/ai",        tags=["AI"])
app.include_router(generator_router, prefix="/api/generator", tags=["Generator"])
app.include_router(storage_router,   prefix="/api/storage",   tags=["Storage"])

@app.get("/")
async def root():
    return {"message": "CV Builder API Running", "version": "1.0.0"}
