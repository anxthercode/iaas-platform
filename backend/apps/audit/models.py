import uuid
from django.db import models


class Task(models.Model):
    """
    Асинхронные задачи — ядро облачных операций.
    Каждая операция с ресурсом (создать VM, прикрепить диск и т.п.) порождает Task.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "В очереди"
        RUNNING = "running", "Выполняется"
        SUCCESS = "success", "Успешно"
        FAILED = "failed", "Ошибка"
        CANCELED = "canceled", "Отменена"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.ForeignKey(
        "tenants.Tenant", null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    project = models.ForeignKey(
        "tenants.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )

    requested_by = models.ForeignKey(
        "iam.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="tasks"
    )
    # Если была impersonation — реальный исполнитель
    impersonator = models.ForeignKey(
        "iam.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="impersonated_tasks"
    )

    action = models.CharField(max_length=64)        # e.g. "vm.create", "vm.start", "disk.attach"

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    progress = models.PositiveSmallIntegerField(default=0)  # 0–100

    resource_kind = models.CharField(max_length=32, blank=True)  # "vm", "disk", …
    resource_id = models.UUIDField(null=True, blank=True)

    external_id = models.CharField(max_length=512, blank=True)  # Proxmox UPID
    external_node = models.CharField(max_length=128, blank=True)  # Proxmox node for UPID polling

    request_payload = models.JSONField(default=dict, blank=True)
    result_payload = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "tasks"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.status}] {self.action} ({self.id})"


class AuditLog(models.Model):
    """Аудит-лог: кто, что, когда и над каким ресурсом."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    occurred_at = models.DateTimeField(auto_now_add=True)

    actor_user = models.ForeignKey(
        "iam.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_actions"
    )
    # Реальный пользователь, если actor действовал через impersonation (support session)
    impersonator = models.ForeignKey(
        "iam.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_impersonations"
    )

    tenant = models.ForeignKey(
        "tenants.Tenant", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )
    project = models.ForeignKey(
        "tenants.Project", null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs"
    )

    action = models.CharField(max_length=128)        # "tenant.create", "vm.start", "quota.update"
    target_kind = models.CharField(max_length=64, blank=True)   # "vm", "disk", "tenant"
    target_id = models.UUIDField(null=True, blank=True)

    message = models.TextField(blank=True)           # Человекочитаемое описание
    diff = models.JSONField(default=dict, blank=True) # {"power_state": ["stopped","running"]}

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-occurred_at"]

    def __str__(self):
        return f"[{self.occurred_at}] {self.actor_user} — {self.action}"


class SupportSession(models.Model):
    """
    Сессии поддержки (impersonation).
    Инженер support заходит в тенант без знания пароля клиента.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    support_user = models.ForeignKey(
        "iam.User", on_delete=models.CASCADE, related_name="support_sessions_opened"
    )
    tenant = models.ForeignKey(
        "tenants.Tenant", null=True, blank=True, on_delete=models.SET_NULL, related_name="support_sessions"
    )
    # Под кого "зашли"
    impersonated_user = models.ForeignKey(
        "iam.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="impersonated_sessions"
    )

    reason = models.TextField(blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "support_sessions"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Session {self.id}: {self.support_user} → {self.tenant} ({'active' if self.is_active else 'ended'})"
