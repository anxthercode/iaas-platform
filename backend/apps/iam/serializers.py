from rest_framework import serializers
from .models import User, RegistrationRequest


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    tenant = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "full_name",
            "is_active", "is_staff", "must_change_password",
            "role", "tenant", "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_role(self, obj):
        membership = obj.tenant_memberships.first()
        if obj.is_staff:
            return "provider_admin"
        return membership.role if membership else None

    def get_tenant(self, obj):
        membership = obj.tenant_memberships.select_related("tenant").first()
        if membership:
            tenant = membership.tenant
            project = tenant.projects.first()
            return {
                "id": str(tenant.id),
                "name": tenant.name,
                "project_id": str(project.id) if project else None,
            }
        return None


class RegistrationRequestSerializer(serializers.ModelSerializer):
    reviewed_by_email = serializers.CharField(
        source="reviewed_by.email", read_only=True, default=None
    )

    class Meta:
        model = RegistrationRequest
        fields = [
            "id", "email", "type", "full_name",
            "company_name", "company_inn", "phone", "comment",
            "status", "reviewed_by", "reviewed_by_email",
            "reviewed_at", "decision_note",
            "created_user", "created_tenant", "created_project",
            "provision_task", "created_at",
        ]
        read_only_fields = [
            "id", "status", "reviewed_by", "reviewed_at",
            "created_user", "created_tenant", "created_project",
            "provision_task", "created_at",
        ]


class RegistrationRequestCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(min_length=6, write_only=True)
    password2 = serializers.CharField(min_length=6, write_only=True)

    class Meta:
        model = RegistrationRequest
        fields = [
            "email", "type", "full_name",
            "company_name", "company_inn", "phone", "comment",
            "password", "password2",
        ]

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError({"password2": "Пароли не совпадают"})
        return data


class ApproveUserRequestSerializer(serializers.Serializer):
    login = serializers.EmailField(help_text="Логин (email) для нового пользователя")
    password = serializers.CharField(min_length=6, help_text="Одноразовый пароль")
    role = serializers.ChoiceField(
        choices=["tenant_admin", "tenant_user", "auditor"],
        default="tenant_user",
    )
    tenant_id = serializers.UUIDField(help_text="UUID тенанта для привязки")


class ApproveTenantRequestSerializer(serializers.Serializer):
    tenant_name = serializers.CharField(max_length=256)
    tenant_slug = serializers.SlugField(max_length=64)
    contact_email = serializers.EmailField(
        help_text="Email контактного лица (админа тенанта)"
    )
    vdc_name = serializers.CharField(
        max_length=128, default="default",
        help_text="Название VDC/Project"
    )
    cpu_limit = serializers.IntegerField(min_value=1, default=10)
    ram_mb_limit = serializers.IntegerField(min_value=512, default=20480)
    disk_gb_limit = serializers.IntegerField(min_value=10, default=500)
    vm_limit = serializers.IntegerField(min_value=1, default=5)


class RejectRequestSerializer(serializers.Serializer):
    decision_note = serializers.CharField(
        required=False, default="", allow_blank=True,
        help_text="Причина отклонения"
    )
