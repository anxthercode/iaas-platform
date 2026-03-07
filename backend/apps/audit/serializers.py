from rest_framework import serializers
from .models import AuditLog, Task, SupportSession


class AuditLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor_user.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = [
            "id", "occurred_at", "actor_user", "actor_email",
            "tenant", "project", "action", "target_kind", "target_id",
            "message", "diff", "ip_address",
        ]


class TaskSerializer(serializers.ModelSerializer):
    requested_by_email = serializers.CharField(
        source="requested_by.email", read_only=True, default=None
    )

    class Meta:
        model = Task
        fields = [
            "id", "tenant", "project", "requested_by", "requested_by_email",
            "action", "status", "progress",
            "resource_kind", "resource_id",
            "external_id", "external_node",
            "request_payload", "result_payload", "error_message",
            "created_at", "started_at", "finished_at",
        ]


class SupportSessionSerializer(serializers.ModelSerializer):
    support_user_email = serializers.CharField(
        source="support_user.email", read_only=True
    )
    tenant_name = serializers.CharField(
        source="tenant.name", read_only=True, default=None
    )

    class Meta:
        model = SupportSession
        fields = [
            "id", "support_user", "support_user_email",
            "tenant", "tenant_name",
            "reason", "started_at", "ended_at", "is_active",
        ]
