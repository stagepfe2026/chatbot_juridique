from fastapi import APIRouter, Depends, Request, Response, status

from app.auth import disconnect_all_user_devices, get_current_user_from_request, login_user, logout_user, update_current_user_password, update_current_user_profile
from app.schemas import AuthUser, DisconnectDevicesResponse, LoginRequest, LoginResponse, UpdatePasswordRequest, UpdateProfileRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response):
    return login_user(email=payload.email, password=payload.password, response=response, request=request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response):
    logout_user(request=request, response=response)
    return None


@router.get("/me", response_model=AuthUser)
def me(current_user: AuthUser = Depends(get_current_user_from_request)):
    return current_user


@router.put("/me", response_model=AuthUser)
def update_me(payload: UpdateProfileRequest, request: Request):
    return update_current_user_profile(payload=payload, request=request)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_me_password(payload: UpdatePasswordRequest, request: Request):
    update_current_user_password(payload=payload, request=request)
    return None


@router.post("/me/disconnect-all-devices", response_model=DisconnectDevicesResponse)
def disconnect_me_devices(request: Request, response: Response):
    closed_sessions = disconnect_all_user_devices(request=request, response=response)
    return DisconnectDevicesResponse(closedSessions=closed_sessions)
