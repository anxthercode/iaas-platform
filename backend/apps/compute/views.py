from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from apps.tenants.models import Project
from .models import VirtualMachine, ComputeNode, Network, Firewall, FirewallRule, OSTemplate, Flavor
from .serializers import (
    VMSerializer, VMCreateSerializer,
    ComputeNodeSerializer,
    NetworkSerializer, FirewallSerializer, FirewallRuleSerializer,
    OSTemplateSerializer, FlavorSerializer,
)
from . import services
from apps.iam.permissions import IsProviderAdmin


class VMListView(generics.ListCreateAPIView):
    serializer_class = VMSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = VirtualMachine.objects.select_related("project__tenant")
        user = self.request.user
        if user.is_staff:
            return qs.all()
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return qs.filter(project__tenant_id__in=tenant_ids)

    def create(self, request, *args, **kwargs):
        serializer = VMCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            project = Project.objects.get(id=data["project_id"])
        except Project.DoesNotExist:
            return Response({"error": "Проект не найден"}, status=404)

        if not request.user.is_staff:
            if not request.user.tenant_memberships.filter(tenant=project.tenant).exists():
                return Response({"error": "Нет доступа к этому проекту"}, status=403)

        result = services.create_vm(
            project=project,
            name=data["name"],
            flavor_name=data["flavor"],
            image_ref=data.get("os_template", ""),
            description=data.get("description", ""),
            network_id=data.get("network_id"),
            ssh_key=data.get("ssh_key", ""),
            user=request.user,
            custom_vcpu=data.get("vcpu"),
            custom_ram_mb=data.get("ram_mb"),
            custom_disk_gb=data.get("disk_gb"),
        )

        if "error" in result:
            return Response({"error": result["error"]}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        return Response({
            "vm": VMSerializer(result["vm"]).data,
            "task_id": str(result["task"].id),
        }, status=status.HTTP_202_ACCEPTED)


class VMDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = VMSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = VirtualMachine.objects.select_related("project__tenant")
        user = self.request.user
        if user.is_staff:
            return qs.all()
        tenant_ids = user.tenant_memberships.values_list("tenant_id", flat=True)
        return qs.filter(project__tenant_id__in=tenant_ids)

    def destroy(self, request, *args, **kwargs):
        vm = self.get_object()
        services.delete_vm(vm.pk, user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def vm_action(request, pk, action):
    action_map = {
        "start": services.start_vm,
        "stop": services.stop_vm,
        "reboot": services.reboot_vm,
        "pause": services.pause_vm,
        "suspend": services.pause_vm,
        "resume": services.resume_vm,
    }
    fn = action_map.get(action)
    if not fn:
        return Response({"error": f"Unknown action: {action}"}, status=400)
    vm = fn(pk, user=request.user)
    return Response(VMSerializer(vm).data)


# ── Infrastructure nodes ──

class ComputeNodeListView(generics.ListAPIView):
    queryset = ComputeNode.objects.all()
    serializer_class = ComputeNodeSerializer
    permission_classes = [IsProviderAdmin]


class ComputeNodeDetailView(generics.RetrieveUpdateAPIView):
    queryset = ComputeNode.objects.all()
    serializer_class = ComputeNodeSerializer
    permission_classes = [IsProviderAdmin]


# ── Networks ──

class NetworkListCreateView(generics.ListCreateAPIView):
    serializer_class = NetworkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Network.objects.filter(project_id=self.kwargs["project_pk"])

    def perform_create(self, serializer):
        project = Project.objects.get(pk=self.kwargs["project_pk"])
        serializer.save(project=project)


class NetworkDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = NetworkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Network.objects.filter(project_id=self.kwargs["project_pk"])


# ── Firewalls ──

class FirewallListCreateView(generics.ListCreateAPIView):
    serializer_class = FirewallSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Firewall.objects.filter(project_id=self.kwargs["project_pk"]).prefetch_related("rules")

    def perform_create(self, serializer):
        project = Project.objects.get(pk=self.kwargs["project_pk"])
        serializer.save(project=project)


class FirewallRuleListCreateView(generics.ListCreateAPIView):
    serializer_class = FirewallRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FirewallRule.objects.filter(firewall_id=self.kwargs["fw_pk"])

    def perform_create(self, serializer):
        firewall = Firewall.objects.get(pk=self.kwargs["fw_pk"])
        serializer.save(firewall=firewall)


class FirewallRuleDeleteView(generics.DestroyAPIView):
    serializer_class = FirewallRuleSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return FirewallRule.objects.filter(firewall_id=self.kwargs["fw_pk"])


# ── Reference data ──

class OSTemplateListView(generics.ListAPIView):
    queryset = OSTemplate.objects.filter(is_public=True)
    serializer_class = OSTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]


class FlavorListView(generics.ListAPIView):
    queryset = Flavor.objects.all()
    serializer_class = FlavorSerializer
    permission_classes = [permissions.IsAuthenticated]
