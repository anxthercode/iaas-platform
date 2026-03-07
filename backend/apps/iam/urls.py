from django.urls import path
from . import views

urlpatterns = [
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("users/", views.UserListView.as_view(), name="user-list"),
    path("register/", views.RegistrationRequestCreateView.as_view(), name="register"),
    path("reset/confirm/", views.reset_password_confirm, name="reset-confirm"),
]
