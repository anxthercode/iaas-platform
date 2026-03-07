import logging
from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.response import Response

logger = logging.getLogger("apps.iam")

from .models import User, RegistrationRequest
from .serializers import (
    UserSerializer,
    RegistrationRequestSerializer,
    RegistrationRequestCreateSerializer,
    ApproveUserRequestSerializer,
    ApproveTenantRequestSerializer,
    RejectRequestSerializer,
)
from .permissions import IsProviderAdmin, IsAdminRole
from .email import send_credentials_email

from apps.tenants.models import Tenant, TenantMember, Project
from apps.quotas.models import Quota, UsageCounter
from apps.audit.models import Task
from apps.audit import services as audit


# ─── Профиль текущего пользователя ───

class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


# ─── Список пользователей (для провайдера) ───

class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsProviderAdmin]


# ─── Публичная подача заявки (без авторизации) ───

class RegistrationRequestCreateView(generics.CreateAPIView):
    serializer_class = RegistrationRequestCreateSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data["email"]

        if User.objects.filter(email=email).exists():
            return Response(
                {"email": ["Пользователь с таким email уже зарегистрирован"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_password = data.pop("password")
        data.pop("password2", None)

        reg = RegistrationRequest.objects.create(**data)

        user = User.objects.create_user(
            email=email,
            username=email.split("@")[0],
            full_name=reg.full_name,
            password=raw_password,
            is_active=True,
        )

        reg.created_user = user
        reg.save()

        return Response(
            RegistrationRequestSerializer(reg).data,
            status=status.HTTP_201_CREATED,
        )


# ─── Список заявок для админа (фильтрация по type и status) ───

class RegistrationRequestListView(generics.ListAPIView):
    serializer_class = RegistrationRequestSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        qs = RegistrationRequest.objects.select_related(
            "reviewed_by", "created_user", "created_tenant", "created_project"
        )
        req_type = self.request.query_params.get("type")
        req_status = self.request.query_params.get("status")
        if req_type in ("user", "tenant"):
            qs = qs.filter(type=req_type)
        if req_status:
            qs = qs.filter(status=req_status)
        return qs


# ─── Детали заявки ───

class RegistrationRequestDetailView(generics.RetrieveAPIView):
    queryset = RegistrationRequest.objects.all()
    serializer_class = RegistrationRequestSerializer
    permission_classes = [IsAdminRole]


# ─── 1.1  Одобрение заявки на создание пользователя ───

@api_view(["POST"])
@perm_classes([IsAdminRole])
def approve_user_request(request, pk):
    """
    POST /api/admin/registration-requests/<uuid>/approve-user/
    Body: { login, password, role, tenant_id }
    """
    try:
        reg = RegistrationRequest.objects.get(pk=pk)
    except RegistrationRequest.DoesNotExist:
        return Response({"error": "Заявка не найдена"}, status=404)

    if reg.type != RegistrationRequest.Type.USER:
        return Response(
            {"error": "Данная заявка не является заявкой на создание пользователя"},
            status=400,
        )
    if reg.status not in (
        RegistrationRequest.Status.SUBMITTED,
    ):
        return Response(
            {"error": f"Невозможно одобрить заявку в статусе '{reg.status}'"},
            status=409,
        )

    ser = ApproveUserRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    try:
        tenant = Tenant.objects.get(pk=data["tenant_id"])
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    with transaction.atomic():
        if reg.created_user is not None:
            user = reg.created_user
        else:
            user = User.objects.create_user(
                email=data["login"],
                password=data["password"],
                username=data["login"].split("@")[0],
                full_name=reg.full_name,
                must_change_password=True,
                is_active=True,
            )

        membership, _ = TenantMember.objects.get_or_create(
            tenant=tenant,
            user=user,
            defaults={"role": data["role"]},
        )
        if not _:
            membership.role = data["role"]
            membership.save()

        reg.status = RegistrationRequest.Status.APPROVED
        reg.reviewed_by = request.user
        reg.reviewed_at = timezone.now()
        reg.created_user = user
        reg.save()

        audit.log(
            actor_user=request.user,
            action="registration_request.approved",
            target_kind="registration_request",
            target_id=reg.pk,
            tenant=tenant,
            message=(
                f"Заявка на пользователя одобрена. "
                f"Создан {user.email} с ролью {data['role']} "
                f"в тенанте {tenant.name}"
            ),
            request=request,
        )
        audit.log(
            actor_user=request.user,
            action="user.created",
            target_kind="user",
            target_id=user.pk,
            tenant=tenant,
            message=f"Создан пользователь {user.email} (full_name={user.full_name})",
            request=request,
        )

    send_credentials_email(reg.email, data["login"], data["password"])

    return Response(
        RegistrationRequestSerializer(reg).data,
        status=200,
    )


# ─── 1.3  Одобрение заявки на создание тенанта ───

@api_view(["POST"])
@perm_classes([IsAdminRole])
def approve_tenant_request(request, pk):
    """
    POST /api/admin/registration-requests/<uuid>/approve-tenant/
    Полная транзакция: tenant → VDC → quota → user → membership → task → audit.
    """
    try:
        reg = RegistrationRequest.objects.get(pk=pk)
    except RegistrationRequest.DoesNotExist:
        return Response({"error": "Заявка не найдена"}, status=404)

    if reg.type != RegistrationRequest.Type.TENANT:
        return Response(
            {"error": "Данная заявка не является заявкой на создание тенанта"},
            status=400,
        )
    if reg.status not in (
        RegistrationRequest.Status.SUBMITTED,
    ):
        return Response(
            {"error": f"Approve разрешён только из статуса 'submitted', текущий: '{reg.status}'"},
            status=409,
        )

    # Идемпотентность: если сущности уже созданы
    if reg.created_tenant is not None:
        return Response({
            "tenant_id": str(reg.created_tenant_id),
            "vdc_id": str(reg.created_project_id),
            "provision_task_id": str(reg.provision_task_id) if reg.provision_task_id else None,
        }, status=200)

    ser = ApproveTenantRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    with transaction.atomic():
        # 1. Создаём тенант
        tenant = Tenant.objects.create(
            name=data["tenant_name"],
            slug=data["tenant_slug"],
            status=Tenant.Status.ACTIVE,
        )

        # 2. Создаём VDC/Project
        project = Project.objects.create(
            tenant=tenant,
            name=data["vdc_name"],
            description=f"VDC по умолчанию для {tenant.name}",
        )

        # 3. Создаём квоту на уровне тенанта
        Quota.objects.create(
            tenant=tenant,
            cpu_cores=data["cpu_limit"],
            ram_mb=data["ram_mb_limit"],
            disk_gb=data["disk_gb_limit"],
            vm_count=data["vm_limit"],
        )

        # 3.1 Инициализируем счётчик использования
        UsageCounter.objects.create(tenant=tenant)

        # 4. Создаём/используем пользователя для контактного лица
        contact_email = data["contact_email"]
        user, user_created = User.objects.get_or_create(
            email=contact_email,
            defaults={
                "username": contact_email.split("@")[0],
                "full_name": reg.full_name,
                "must_change_password": True,
            },
        )
        if user_created:
            temp_pw = User.objects.make_random_password(length=12)
            user.set_password(temp_pw)
            user.save()
            send_credentials_email(contact_email, contact_email, temp_pw)

        # 4.1 Привязка как TENANT_ADMIN
        TenantMember.objects.get_or_create(
            tenant=tenant,
            user=user,
            defaults={"role": TenantMember.Role.TENANT_ADMIN},
        )

        # 5. Создаём асинхронную задачу TENANT_PROVISION
        task = Task.objects.create(
            tenant=tenant,
            project=project,
            requested_by=request.user,
            action="tenant.provision",
            status=Task.Status.PENDING,
            resource_kind="tenant",
            resource_id=tenant.pk,
            request_payload={
                "tenant_id": str(tenant.pk),
                "vdc_id": str(project.pk),
                "infra_profile": "mock",
                "quotas": {
                    "cpu_cores": data["cpu_limit"],
                    "ram_mb": data["ram_mb_limit"],
                    "disk_gb": data["disk_gb_limit"],
                    "vm_count": data["vm_limit"],
                },
            },
        )

        # 6. Обновляем заявку
        reg.status = RegistrationRequest.Status.APPROVED
        reg.reviewed_by = request.user
        reg.reviewed_at = timezone.now()
        reg.created_user = user
        reg.created_tenant = tenant
        reg.created_project = project
        reg.provision_task = task
        reg.save()

        # 7. Аудит-лог
        audit.log(
            actor_user=request.user,
            action="registration_request.approved",
            target_kind="registration_request",
            target_id=reg.pk,
            tenant=tenant,
            message=f"Заявка на тенант одобрена → tenant: {tenant.name}",
            request=request,
        )
        audit.log(
            actor_user=request.user,
            action="tenant.created",
            target_kind="tenant",
            target_id=tenant.pk,
            tenant=tenant,
            message=f"Создан тенант {tenant.name} (slug={tenant.slug})",
            diff={
                "cpu_limit": data["cpu_limit"],
                "ram_mb_limit": data["ram_mb_limit"],
                "disk_gb_limit": data["disk_gb_limit"],
                "vm_limit": data["vm_limit"],
            },
            request=request,
        )
        audit.log(
            actor_user=request.user,
            action="vdc.created",
            target_kind="project",
            target_id=project.pk,
            tenant=tenant,
            project=project,
            message=f"Создан VDC/Project '{project.name}' для {tenant.name}",
            request=request,
        )

    return Response(
        {
            "tenant_id": str(tenant.pk),
            "vdc_id": str(project.pk),
            "provision_task_id": str(task.pk),
            "contact_user_id": str(user.pk),
            "user_created": user_created,
        },
        status=201,
    )


# ─── Отклонение заявки (универсальное) ───

@api_view(["POST"])
@perm_classes([IsAdminRole])
def reject_request(request, pk):
    """
    POST /api/admin/registration-requests/<uuid>/reject/
    """
    try:
        reg = RegistrationRequest.objects.get(pk=pk)
    except RegistrationRequest.DoesNotExist:
        return Response({"error": "Заявка не найдена"}, status=404)

    if reg.status != RegistrationRequest.Status.SUBMITTED:
        return Response(
            {"error": f"Невозможно отклонить заявку в статусе '{reg.status}'"},
            status=409,
        )

    ser = RejectRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)

    reg.status = RegistrationRequest.Status.REJECTED
    reg.reviewed_by = request.user
    reg.reviewed_at = timezone.now()
    reg.decision_note = ser.validated_data.get("decision_note", "")
    reg.save()

    audit.log(
        actor_user=request.user,
        action="registration_request.rejected",
        target_kind="registration_request",
        target_id=reg.pk,
        message=f"Заявка от {reg.email} отклонена. Причина: {reg.decision_note}",
        request=request,
    )

    return Response(RegistrationRequestSerializer(reg).data, status=200)


# ─── Прямое создание тенанта провайдером (без заявки) ───

@api_view(["POST"])
@perm_classes([IsProviderAdmin])
def admin_create_tenant(request):
    """
    POST /api/admin/tenants/create/
    Создаёт тенант напрямую без RegistrationRequest.
    Body: { name, email, cpu_limit, ram_mb_limit, disk_gb_limit, vm_limit, vdc_name?, password? }
    """
    from rest_framework import serializers as drf_serializers

    class DirectTenantSerializer(drf_serializers.Serializer):
        name = drf_serializers.CharField(max_length=256)
        email = drf_serializers.EmailField()
        password = drf_serializers.CharField(min_length=6, default="TempPass123!")
        cpu_limit = drf_serializers.IntegerField(min_value=1, default=10)
        ram_mb_limit = drf_serializers.IntegerField(min_value=512, default=20480)
        disk_gb_limit = drf_serializers.IntegerField(min_value=10, default=500)
        vm_limit = drf_serializers.IntegerField(min_value=1, default=5)
        vdc_name = drf_serializers.CharField(default="default")

    ser = DirectTenantSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    slug = data["name"].lower()
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", slug)[:60].strip("-")

    if Tenant.objects.filter(slug=slug).exists():
        slug = slug[:55] + "-" + str(Tenant.objects.count())

    with transaction.atomic():
        tenant = Tenant.objects.create(
            name=data["name"],
            slug=slug,
            status=Tenant.Status.ACTIVE,
        )
        project = Project.objects.create(
            tenant=tenant,
            name=data["vdc_name"],
            description=f"VDC по умолчанию для {tenant.name}",
        )
        Quota.objects.create(
            tenant=tenant,
            cpu_cores=data["cpu_limit"],
            ram_mb=data["ram_mb_limit"],
            disk_gb=data["disk_gb_limit"],
            vm_count=data["vm_limit"],
        )
        UsageCounter.objects.create(tenant=tenant)

        contact_email = data["email"]
        user, user_created = User.objects.get_or_create(
            email=contact_email,
            defaults={
                "username": contact_email.split("@")[0],
                "full_name": "",
                "must_change_password": True,
            },
        )
        if user_created:
            user.set_password(data["password"])
            user.save()

        TenantMember.objects.get_or_create(
            tenant=tenant,
            user=user,
            defaults={"role": TenantMember.Role.TENANT_ADMIN},
        )

        task = Task.objects.create(
            tenant=tenant,
            project=project,
            requested_by=request.user,
            action="tenant.provision",
            status=Task.Status.PENDING,
            resource_kind="tenant",
            resource_id=tenant.pk,
        )

        audit.log(
            actor_user=request.user,
            action="tenant.created",
            target_kind="tenant",
            target_id=tenant.pk,
            tenant=tenant,
            message=f"Тенант '{tenant.name}' создан напрямую провайдером",
            request=request,
        )

    from apps.tenants.serializers import TenantSerializer
    return Response({
        "tenant": TenantSerializer(tenant).data,
        "project_id": str(project.id),
        "task_id": str(task.id),
        "admin_user_id": str(user.id),
        "admin_created": user_created,
    }, status=201)


# ─── Подтверждение сброса пароля ───

@api_view(["POST"])
@perm_classes([permissions.AllowAny])
def reset_password_confirm(request):
    """
    POST /api/auth/reset/confirm/
    Body: { token, new_password }
    """
    token = request.data.get("token")
    new_password = request.data.get("new_password")
    if not token or not new_password:
        return Response({"error": "token и new_password обязательны"}, status=400)
    if len(new_password) < 6:
        return Response({"error": "Пароль должен содержать минимум 6 символов"}, status=400)

    try:
        user = User.objects.get(reset_token=token)
    except User.DoesNotExist:
        return Response({"error": "Недействительный или просроченный токен"}, status=400)

    if user.reset_token_expires_at and user.reset_token_expires_at < timezone.now():
        user.reset_token = None
        user.reset_token_expires_at = None
        user.save()
        return Response({"error": "Токен просрочен"}, status=400)

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    user.must_change_password = False
    user.save()

    return Response({"message": "Пароль успешно изменён"})
