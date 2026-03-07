from rest_framework import serializers
from .models import Tenant, TenantMember
from apps.quotas.models import Quota, UsageCounter


class QuotaInlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Quota
        fields = ["cpu_cores", "ram_mb", "disk_gb", "vm_count", "public_ip_count"]


class UsageInlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = UsageCounter
        fields = [
            "used_cpu_cores", "used_ram_mb", "used_disk_gb",
            "used_vm_count", "used_public_ips",
        ]


class TenantSerializer(serializers.ModelSerializer):
    quota = QuotaInlineSerializer(read_only=True)
    usage = UsageInlineSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = [
            "id", "name", "slug", "status", "created_at",
            "quota", "usage", "member_count",
        ]
        read_only_fields = ["id", "created_at"]

    def get_member_count(self, obj):
        return obj.members.count()


class TenantMemberSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source="user.email", read_only=True)
    user_full_name = serializers.CharField(source="user.full_name", read_only=True)

    class Meta:
        model = TenantMember
        fields = [
            "id", "tenant", "user", "user_email",
            "user_full_name", "role", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class QuotaUpdateSerializer(serializers.Serializer):
    cpu_cores = serializers.IntegerField(min_value=1, required=False)
    ram_mb = serializers.IntegerField(min_value=512, required=False)
    disk_gb = serializers.IntegerField(min_value=10, required=False)
    vm_count = serializers.IntegerField(min_value=1, required=False)
    public_ip_count = serializers.IntegerField(min_value=0, required=False)


class InviteUserSerializer(serializers.Serializer):
    email = serializers.EmailField()
    name = serializers.CharField(max_length=256, required=False, default="")
    role = serializers.ChoiceField(
        choices=["tenant_admin", "tenant_user"],
        default="tenant_user",
    )


class ResetPasswordConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=6)
