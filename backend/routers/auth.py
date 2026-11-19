"""Authentication routes — signup, login, current user."""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import PasswordResetToken, User
from schemas.auth import ForgotPasswordRequest, LoginRequest, ResetPasswordRequest, SignupRequest, TokenResponse
from schemas.user import UserResponse, UserUpdate
from utils.dependencies import get_current_user
from utils.security import create_access_token, hash_password, verify_password

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user account."""
    clean_email = body.email.strip().lower()
    existing = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=clean_email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and receive a JWT token."""
    clean_email = body.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact support.",
        )

    token = create_access_token({"sub": user.id})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update profile details for current user."""
    from models import UserRole

    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
    if body.role is not None:
        try:
            current_user.role = UserRole(body.role)
        except ValueError:
            pass

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/forgot-password")
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Initiate a password reset flow."""
    user = db.query(User).filter(User.email == body.email).first()

    generic_response = {
        "message": "If that email is registered, a password reset link has been sent."
    }

    if not user:
        return generic_response

    # Invalidate any existing unused tokens for this email
    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == body.email,
        PasswordResetToken.used == False,
    ).delete()

    reset_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    record = PasswordResetToken(
        email=user.email,
        token=reset_token,
        expires_at=expires_at,
        used=False,
    )
    db.add(record)
    db.commit()

    return generic_response


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset user password using a valid, unexpired token."""
    now = datetime.now(timezone.utc)

    record = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.email == body.email,
            PasswordResetToken.token == body.token,
            PasswordResetToken.used == False,
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    token_expires = record.expires_at
    if token_expires.tzinfo is None:
        token_expires = token_expires.replace(tzinfo=timezone.utc)

    if now > token_expires:
        record.used = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(body.new_password)
    record.used = True
    db.commit()

    return {"message": "Password updated successfully. Please log in with your new password."}
