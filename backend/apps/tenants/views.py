import secrets
from datetime import timedelta

from django.utils import timezone
from django.db import transaction
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes as perm_classes
from rest_framework.response import Response

from .models import Tenant, TenantMember
from .serializers import (
    TenantSerializer,
    TenantMemberSerializer,
    QuotaUpdateSerializer,
    InviteUserSerializer,
)
from apps.iam.models import User
from apps.iam.permissions import IsProviderAdmin, IsTenantAdmin
from apps.iam.email import send_invite_email, send_reset_email
from apps.quotas.models import Quota
from apps.audit import services as audit
from django.conf import settings


class TenantListView(generics.ListCreateAPIView):
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Tenant.objects.prefetch_related("members").all()
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return Tenant.objects.filter(id__in=tenant_ids).prefetch_related("members")

    def perform_create(self, serializer):
        serializer.save()


class TenantDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Tenant.objects.all()
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return Tenant.objects.filter(id__in=tenant_ids)


class TenantQuotaUpdateView(generics.GenericAPIView):
    permission_classes = [IsProviderAdmin]

    def patch(self, request, pk):
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            return Response({"error": "Тенант не найден"}, status=404)

        ser = QuotaUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        quota, created = Quota.objects.get_or_create(tenant=tenant)
        old_values = {}
        new_values = {}
        for field, value in ser.validated_data.items():
            old_val = getattr(quota, field)
            if old_val != value:
                old_values[field] = old_val
                new_values[field] = value
                setattr(quota, field, value)
        quota.save()

        if old_values:
            audit.log(
                actor_user=request.user,
                action="quota.updated",
                target_kind="tenant",
                target_id=tenant.pk,
                tenant=tenant,
                message=f"Квота тенанта {tenant.name} изменена",
                diff={"old": old_values, "new": new_values},
                request=request,
            )

        return Response(TenantSerializer(tenant).data)


@api_view(["POST"])
@perm_classes([IsProviderAdmin])
def tenant_suspend(request, pk):
    try:
        tenant = Tenant.objects.get(pk=pk)
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    if tenant.status == Tenant.Status.SUSPENDED:
        return Response({"error": "Тенант уже заблокирован"}, status=409)

    tenant.status = Tenant.Status.SUSPENDED
    tenant.save()

    audit.log(
        actor_user=request.user,
        action="tenant.suspended",
        target_kind="tenant",
        target_id=tenant.pk,
        tenant=tenant,
        message=f"Тенант {tenant.name} заблокирован",
        diff={"status": ["active", "suspended"]},
        request=request,
    )

    return Response(TenantSerializer(tenant).data)


@api_view(["POST"])
@perm_classes([IsProviderAdmin])
def tenant_resume(request, pk):
    try:
        tenant = Tenant.objects.get(pk=pk)
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    if tenant.status == Tenant.Status.ACTIVE:
        return Response({"error": "Тенант уже активен"}, status=409)

    tenant.status = Tenant.Status.ACTIVE
    tenant.save()

    audit.log(
        actor_user=request.user,
        action="tenant.resumed",
        target_kind="tenant",
        target_id=tenant.pk,
        tenant=tenant,
        message=f"Тенант {tenant.name} разблокирован",
        diff={"status": ["suspended", "active"]},
        request=request,
    )

    return Response(TenantSerializer(tenant).data)


class TenantMembersView(generics.ListAPIView):
    serializer_class = TenantMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TenantMember.objects.filter(
            tenant_id=self.kwargs["pk"]
        ).select_related("user")


# ── Invite user to tenant ──

@api_view(["POST"])
@perm_classes([IsTenantAdmin])
def invite_user(request, pk):
    """
    POST /api/tenants/<uuid>/invite/
    Body: { email, name (опц.), role }
    """
    try:
        tenant = Tenant.objects.get(pk=pk)
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    ser = InviteUserSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    email = data["email"]
    role = data["role"]
    name = data.get("name", "")

    if TenantMember.objects.filter(tenant=tenant, user__email=email).exists():
        return Response({"error": "Пользователь уже является участником тенанта"}, status=409)

    with transaction.atomic():
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "full_name": name,
                "must_change_password": True,
            },
        )

        temp_pw = None
        if created:
            temp_pw = User.objects.make_random_password(length=12)
            user.set_password(temp_pw)
            user.save()

        TenantMember.objects.create(
            tenant=tenant, user=user, role=role,
        )

        audit.log(
            actor_user=request.user,
            action="user.invited",
            target_kind="user",
            target_id=user.pk,
            tenant=tenant,
            message=f"Пользователь {email} приглашён с ролью {role}",
            request=request,
        )

    if created and temp_pw:
        send_invite_email(email, tenant.name, temp_pw)

    return Response({
        "user_id": str(user.pk),
        "email": email,
        "role": role,
        "user_created": created,
    }, status=201)


# ── Remove member from tenant ──

@api_view(["DELETE"])
@perm_classes([IsTenantAdmin])
def remove_member(request, pk, member_pk):
    """
    DELETE /api/tenants/<uuid>/members/<member_uuid>/
    """
    try:
        tenant = Tenant.objects.get(pk=pk)
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    try:
        member = TenantMember.objects.select_related("user").get(pk=member_pk, tenant=tenant)
    except TenantMember.DoesNotExist:
        return Response({"error": "Участник не найден"}, status=404)

    if member.user == request.user:
        return Response({"error": "Нельзя удалить себя из тенанта"}, status=400)

    audit.log(
        actor_user=request.user,
        action="member.removed",
        target_kind="tenant_member",
        target_id=member.pk,
        tenant=tenant,
        message=f"Пользователь {member.user.email} удалён из тенанта {tenant.name}",
        request=request,
    )

    member.delete()
    return Response(status=204)


# ── Reset password (tenant admin triggers for a member) ──

@api_view(["POST"])
@perm_classes([IsTenantAdmin])
def reset_password_request(request, pk, user_pk):
    """
    POST /api/tenants/<uuid>/members/<user_uuid>/reset-password/
    """
    try:
        tenant = Tenant.objects.get(pk=pk)
    except Tenant.DoesNotExist:
        return Response({"error": "Тенант не найден"}, status=404)

    if not TenantMember.objects.filter(tenant=tenant, user_id=user_pk).exists():
        return Response({"error": "Пользователь не является участником тенанта"}, status=404)

    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        return Response({"error": "Пользователь не найден"}, status=404)

    token = secrets.token_urlsafe(48)
    user.reset_token = token
    user.reset_token_expires_at = timezone.now() + timedelta(hours=24)
    user.save()

    reset_link = f"{settings.FRONTEND_URL}/reset?token={token}"
    send_reset_email(user.email, reset_link)

    audit.log(
        actor_user=request.user,
        action="password.reset_requested",
        target_kind="user",
        target_id=user.pk,
        tenant=tenant,
        message=f"Сброс пароля запрошен для {user.email}",
        request=request,
    )

    return Response({"message": "Ссылка для сброса пароля отправлена"})
