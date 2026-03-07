from django.urls import path
from . import views

urlpatterns = [
    path("", views.TenantListView.as_view(), name="tenant-list"),
    path("<uuid:pk>/", views.TenantDetailView.as_view(), name="tenant-detail"),
    path("<uuid:pk>/quota/", views.TenantQuotaUpdateView.as_view(), name="tenant-quota"),
    path("<uuid:pk>/suspend/", views.tenant_suspend, name="tenant-suspend"),
    path("<uuid:pk>/resume/", views.tenant_resume, name="tenant-resume"),
    path("<uuid:pk>/members/", views.TenantMembersView.as_view(), name="tenant-members"),
    path("<uuid:pk>/members/<uuid:member_pk>/", views.remove_member, name="tenant-member-remove"),
    path("<uuid:pk>/members/<uuid:user_pk>/reset-password/", views.reset_password_request, name="tenant-member-reset-pw"),
    path("<uuid:pk>/invite/", views.invite_user, name="tenant-invite"),
]
