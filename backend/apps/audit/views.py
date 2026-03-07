from rest_framework import generics, permissions
from .models import AuditLog, Task
from .serializers import AuditLogSerializer, TaskSerializer
from apps.iam.permissions import IsProviderAdmin


class AuditLogListView(generics.ListAPIView):
    """
    GET /api/audit/ — provider admin: все логи (фильтр по tenant, actor, action).
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsProviderAdmin]

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor_user").all()
        tenant_id = self.request.query_params.get("tenant")
        action = self.request.query_params.get("action")
        actor = self.request.query_params.get("actor")
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        if action:
            qs = qs.filter(action__icontains=action)
        if actor:
            qs = qs.filter(actor_user__email__icontains=actor)
        return qs[:200]


class TenantAuditLogListView(generics.ListAPIView):
    """
    GET /api/tenants/<uuid>/audit/ — логи конкретного тенанта.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        tenant_pk = self.kwargs["pk"]
        user = self.request.user
        if not user.is_staff:
            if not user.tenant_memberships.filter(tenant_id=tenant_pk).exists():
                return AuditLog.objects.none()
        return AuditLog.objects.filter(tenant_id=tenant_pk).select_related("actor_user")[:200]


class TaskListView(generics.ListAPIView):
    """
    GET /api/audit/tasks/ — список всех задач (Proxmox operations).
    """
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.select_related("requested_by").order_by("-created_at")
        user = self.request.user
        if user.is_staff:
            return qs.all()[:100]
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return qs.filter(tenant_id__in=tenant_ids)[:100]


class TaskDetailView(generics.RetrieveAPIView):
    """
    GET /api/audit/tasks/<uuid>/ — статус задачи (tenant-scoped).
    """
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Task.objects.select_related("requested_by")
        user = self.request.user
        if user.is_staff:
            return qs.all()
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return qs.filter(tenant_id__in=tenant_ids)
