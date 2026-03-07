from rest_framework import serializers
from .models import VirtualMachine, ComputeNode, Network, Firewall, FirewallRule, OSTemplate, Flavor


class VMSerializer(serializers.ModelSerializer):
    tenant_id = serializers.UUIDField(source="project.tenant_id", read_only=True)
    tenant_name = serializers.CharField(source="project.tenant.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = VirtualMachine
        fields = [
            "id", "name", "description", "project", "project_name",
            "tenant_id", "tenant_name",
            "power_state", "vcpu", "ram_mb", "disk_gb", "flavor",
            "image_ref", "ip_address", "compute_node",
            "hypervisor_vm_ref", "created_at",
        ]
        read_only_fields = [
            "id", "power_state", "hypervisor_vm_ref", "created_at",
            "tenant_id", "tenant_name", "project_name",
            "ip_address", "compute_node",
        ]


class VMCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)
    description = serializers.CharField(required=False, default="", allow_blank=True)
    project_id = serializers.UUIDField()
    os_template = serializers.CharField(max_length=64, required=False, default="", allow_blank=True)
    flavor = serializers.CharField(max_length=32, default="medium")
    network_id = serializers.UUIDField(required=False, allow_null=True, default=None)
    ssh_key = serializers.CharField(required=False, default="", allow_blank=True)
    vcpu = serializers.IntegerField(required=False, min_value=1, max_value=128, default=None)
    ram_mb = serializers.IntegerField(required=False, min_value=512, max_value=524288, default=None)
    disk_gb = serializers.IntegerField(required=False, min_value=10, max_value=10000, default=None)


class ComputeNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComputeNode
        fields = [
            "id", "hostname", "status",
            "cpu_total", "cpu_used", "ram_total_mb", "ram_used_mb",
            "disk_total_gb", "disk_used_gb",
            "vm_count", "uptime", "updated_at",
        ]
        read_only_fields = ["id", "updated_at"]


class NetworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Network
        fields = ["id", "project", "name", "cidr", "is_public", "created_at"]
        read_only_fields = ["id", "created_at"]


class FirewallSerializer(serializers.ModelSerializer):
    rules_count = serializers.SerializerMethodField()

    class Meta:
        model = Firewall
        fields = ["id", "project", "name", "description", "rules_count", "created_at"]
        read_only_fields = ["id", "created_at"]

    def get_rules_count(self, obj):
        return obj.rules.count()


class FirewallRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FirewallRule
        fields = [
            "id", "firewall", "direction", "protocol",
            "port_range", "remote_cidr", "action",
            "priority", "description", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class OSTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = OSTemplate
        fields = ["id", "name", "slug", "min_disk_gb", "is_public"]


class FlavorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flavor
        fields = ["id", "name", "vcpu", "ram_mb", "disk_gb", "price_label"]
