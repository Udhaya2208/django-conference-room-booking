import json
from functools import wraps
from django.contrib.auth import  logout
from django.shortcuts import redirect
from django.http import JsonResponse
from roomBooking.models import UserProfile


def validate_session_token(view_func):
    """Custom decorator to validate the session token stored in the user profile."""

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        def session_fail():
            logout(request)
            response = redirect("loginPage")
            response.delete_cookie("session_info")
            return response

        # 1. Check if user is logged into Django
        if not request.user.is_authenticated:
            return session_fail()

        # 2. Check cookie existence
        cookie_value = request.COOKIES.get("session_info")
        if not cookie_value:
            return session_fail()

        # 3. Parse JSON cookie safely
        try:
            cookie_data = json.loads(cookie_value)
            session_token_from_cookie = cookie_data.get("session_token")
        except (ValueError, TypeError, json.JSONDecodeError):
            return session_fail()

        if not session_token_from_cookie:
            return session_fail()

        # 4. Verify match against the user's profile record
        try:
            user_profile, created = UserProfile.objects.get_or_create(user=request.user)
            if user_profile.session_token != session_token_from_cookie:
                return session_fail()
        except Exception:
            return session_fail()

        return view_func(request, *args, **kwargs)

    return _wrapped_view