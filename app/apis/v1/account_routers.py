from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.core import default_logger
from app.dependencies.supabase_auth import SupabaseSession, get_supabase_session
from app.services.supabase_admin import (
    SupabaseAdminNotConfiguredError,
    SupabaseAdminRequestError,
    delete_auth_user,
)

account_router = APIRouter(tags=["account"])


@account_router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    session: Annotated[SupabaseSession, Depends(get_supabase_session)],
) -> Response:
    default_logger.info("account_delete_requested")
    try:
        await delete_auth_user(session.user_id)
    except SupabaseAdminNotConfiguredError as error:
        default_logger.warning("account_delete_failed category=not_configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "account_deletion_not_ready", "message": "Account deletion is not available."},
        ) from error
    except SupabaseAdminRequestError as error:
        default_logger.warning("account_delete_failed category=%s", error.category)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "account_deletion_failed", "message": "Account deletion could not be completed."},
        ) from error

    default_logger.info("account_delete_succeeded")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
