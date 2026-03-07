from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.iam.views import (
    RegistrationRequestListView,
    RegistrationRequestDetailView,
    approve_user_request,
    approve_tenant_request,
    reject_request,
    admin_create_tenant,
)
from apps.audit.views import TenantAuditLogListView

urlpatterns = [
    path("admin/", admin.site.urls),

    # Auth
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/", include("apps.iam.urls")),

    # Tenants
    path("api/tenants/", include("apps.tenants.urls")),

    # Compute (VMs, infra, networks, firewalls, ref data)
    path("api/", include("apps.compute.urls")),

    # Audit & Tasks
    path("api/audit/", include("apps.audit.urls")),

    # Tenant-scoped audit log
    path("api/tenants/<uuid:pk>/audit/", TenantAuditLogListView.as_view(), name="tenant-audit"),

    # Admin: Registration Requests
    path(
        "api/admin/registration-requests/",
        RegistrationRequestListView.as_view(),
        name="admin-requests-list",
    ),
    path(
        "api/admin/registration-requests/<uuid:pk>/",
        RegistrationRequestDetailView.as_view(),
        name="admin-request-detail",
    ),
    path(
        "api/admin/registration-requests/<uuid:pk>/approve-user/",
        approve_user_request,
        name="admin-approve-user",
    ),
    path(
        "api/admin/registration-requests/<uuid:pk>/approve-tenant/",
        approve_tenant_request,
        name="admin-approve-tenant",
    ),
    path(
        "api/admin/registration-requests/<uuid:pk>/reject/",
        reject_request,
        name="admin-reject-request",
    ),
    path(
        "api/admin/tenants/create/",
        admin_create_tenant,
        name="admin-create-tenant",
    ),

    # AI Assistant
    path("api/ai/", include("apps.ai_assistant.urls")),
]
