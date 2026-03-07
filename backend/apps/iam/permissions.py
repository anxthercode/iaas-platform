from rest_framework import permissions


class IsProviderAdmin(permissions.BasePermission):
    """
    Доступ только для Provider Admin (is_staff=True).
    """
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_staff
        )


class IsTenantAdmin(permissions.BasePermission):
    """
    Проверяет, что пользователь является tenant_admin в тенанте,
    указанном через URL kwarg 'pk' (tenant uuid).
    Провайдерские админы (is_staff) проходят автоматически.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        tenant_pk = view.kwargs.get("pk")
        if not tenant_pk:
            return False
        return user.tenant_memberships.filter(
            tenant_id=tenant_pk, role="tenant_admin"
        ).exists()


class IsAdminRole(permissions.BasePermission):
    """
    Доступ для Provider Admin (is_staff) или любого Tenant Admin.
    """
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return user.tenant_memberships.filter(role="tenant_admin").exists()
