import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Единая модель пользователя для всей платформы.
    Провайдерские (admin/support) — is_staff=True.
    Клиентские — привязываются через TenantMember.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # email используется как логин (переопределяем USERNAME_FIELD ниже)
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, blank=True)  # не используем, нужен AbstractUser

    full_name = models.CharField(max_length=256, blank=True)

    # is_active и is_staff уже есть в AbstractUser
    # is_active  — блокировка без удаления
    # is_staff   — признак "провайдерского" пользователя (admin / support)

    # last_login уже есть в AbstractUser (last_login_at)
    # date_joined уже есть в AbstractUser (created_at)

    must_change_password = models.BooleanField(default=False)

    reset_token = models.CharField(max_length=128, null=True, blank=True, unique=True)
    reset_token_expires_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]  # нужен для createsuperuser

    class Meta:
        db_table = "users"
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"

    def __str__(self):
        return self.email


class RegistrationRequest(models.Model):
    """Заявки на регистрацию: создание пользователя или тенанта."""

    class Type(models.TextChoices):
        USER = "user", "Заявка на создание пользователя"
        TENANT = "tenant", "Заявка на создание тенанта"

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Новая"
        APPROVED = "approved", "Одобрена"
        REJECTED = "rejected", "Отклонена"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    email = models.EmailField()
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.USER)
    full_name = models.CharField(max_length=256, blank=True)
    company_name = models.CharField(max_length=256, blank=True)
    company_inn = models.CharField(max_length=64, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    comment = models.TextField(blank=True)

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.SUBMITTED
    )

    reviewed_by = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_requests",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision_note = models.TextField(blank=True)

    created_user = models.OneToOneField(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_request",
    )
    created_tenant = models.ForeignKey(
        "tenants.Tenant",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_requests",
    )
    created_project = models.ForeignKey(
        "tenants.Project",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_requests",
    )
    provision_task = models.ForeignKey(
        "audit.Task",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="registration_requests",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "registration_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.status}] {self.email} ({self.get_type_display()})"
