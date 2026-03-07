import uuid
from django.db import models


class Tenant(models.Model):
    """Организации/клиенты (компании)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Активен"
        SUSPENDED = "suspended", "Заблокирован"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=256)
    slug = models.SlugField(max_length=64, unique=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenants"

    def __str__(self):
        return self.name


class TenantMember(models.Model):
    """Участники тенанта и их роль на уровне организации."""

    class Role(models.TextChoices):
        TENANT_ADMIN = "tenant_admin", "Tenant Admin"
        TENANT_USER = "tenant_user", "Tenant User"
        AUDITOR = "auditor", "Auditor"
        # Провайдерские роли (когда support заходит в тенант)
        PROVIDER_ADMIN = "provider_admin", "Provider Admin"
        SUPPORT = "support", "Support"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        "iam.User", on_delete=models.CASCADE, related_name="tenant_memberships"
    )
    role = models.CharField(max_length=32, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "tenant_members"
        unique_together = [("tenant", "user")]

    def __str__(self):
        return f"{self.user} @ {self.tenant} [{self.role}]"


class Project(models.Model):
    """Проекты/VDC внутри тенанта."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "projects"
        unique_together = [("tenant", "name")]

    def __str__(self):
        return f"{self.tenant.slug}/{self.name}"


class ProjectMember(models.Model):
    """Участники проекта и их проектные роли (тоньше, чем tenant-уровень)."""

    class Role(models.TextChoices):
        TENANT_ADMIN = "tenant_admin", "Tenant Admin"
        TENANT_USER = "tenant_user", "Tenant User"
        AUDITOR = "auditor", "Auditor"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="members"
    )
    user = models.ForeignKey(
        "iam.User", on_delete=models.CASCADE, related_name="project_memberships"
    )
    role = models.CharField(max_length=32, choices=Role.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_members"
        unique_together = [("project", "user")]

    def __str__(self):
        return f"{self.user} @ {self.project} [{self.role}]"
