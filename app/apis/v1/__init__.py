from fastapi import APIRouter

from app.apis.v1.auth_routers import auth_router
from app.apis.v1.observation_routers import observation_router
from app.apis.v1.risk_signal_routers import risk_signal_router
from app.apis.v1.user_routers import user_router

v1_routers = APIRouter(prefix="/api/v1")
v1_routers.include_router(auth_router)
v1_routers.include_router(observation_router)
v1_routers.include_router(risk_signal_router)
v1_routers.include_router(user_router)
