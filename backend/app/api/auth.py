from fastapi import APIRouter, Depends, Request, Response, status

from app.auth import get_current_user_from_request, login_user, logout_user
from app.schemas import AuthUser, LoginRequest, LoginResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response):
    return login_user(email=payload.email, password=payload.password, response=response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response):
    logout_user(request=request, response=response)
    return None


@router.get("/me", response_model=AuthUser)
def me(current_user: AuthUser = Depends(get_current_user_from_request)):
    return current_user
