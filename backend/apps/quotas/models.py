import uuid
from django.db import models


class Quota(models.Model):
    """
    Квоты (лимиты ресурсов) на уровне tenant или project.
    Ровно одно из полей tenant/project должно быть заполнено.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.OneToOneField(
        "tenants.Tenant",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="quota",
    )
    project = models.OneToOneField(
        "tenants.Project",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="quota",
    )

    cpu_cores = models.PositiveIntegerField(default=10)
    ram_mb = models.PositiveIntegerField(default=20480)    # 20 GB
    disk_gb = models.PositiveIntegerField(default=500)
    vm_count = models.PositiveIntegerField(default=5)
    public_ip_count = models.PositiveIntegerField(default=2)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "quotas"
        # Ровно один из двух FK должен быть заполнен — проверяется в clean()
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tenant__isnull=False, project__isnull=True) |
                    models.Q(tenant__isnull=True, project__isnull=False)
                ),
                name="quota_tenant_xor_project",
            )
        ]

    def __str__(self):
        target = self.tenant or self.project
        return f"Quota for {target}"


class UsageCounter(models.Model):
    """
    Текущее потребление ресурсов (кэш для быстрого отображения в UI).
    Обновляется синхронно при создании/удалении ресурсов.
    Ровно одно из полей tenant/project должно быть заполнено.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    tenant = models.OneToOneField(
        "tenants.Tenant",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="usage",
    )
    project = models.OneToOneField(
        "tenants.Project",
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name="usage",
    )

    used_cpu_cores = models.PositiveIntegerField(default=0)
    used_ram_mb = models.PositiveIntegerField(default=0)
    used_disk_gb = models.PositiveIntegerField(default=0)
    used_vm_count = models.PositiveIntegerField(default=0)
    used_public_ips = models.PositiveIntegerField(default=0)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "usage_counters"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(tenant__isnull=False, project__isnull=True) |
                    models.Q(tenant__isnull=True, project__isnull=False)
                ),
                name="usage_tenant_xor_project",
            )
        ]

    def __str__(self):
        target = self.tenant or self.project
        return f"Usage for {target}"
