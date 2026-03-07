from django.urls import path
from .views import (
    VMListView, VMDetailView, vm_action,
    ComputeNodeListView, ComputeNodeDetailView,
    NetworkListCreateView, NetworkDetailView,
    FirewallListCreateView, FirewallRuleListCreateView, FirewallRuleDeleteView,
    OSTemplateListView, FlavorListView,
)

urlpatterns = [
    # VMs
    path("vms/", VMListView.as_view(), name="vm-list"),
    path("vms/<uuid:pk>/", VMDetailView.as_view(), name="vm-detail"),
    path("vms/<uuid:pk>/<str:action>/", vm_action, name="vm-action"),

    # Infrastructure nodes
    path("infrastructure/nodes/", ComputeNodeListView.as_view(), name="node-list"),
    path("infrastructure/nodes/<uuid:pk>/", ComputeNodeDetailView.as_view(), name="node-detail"),

    # Networks (project-scoped)
    path("projects/<uuid:project_pk>/networks/", NetworkListCreateView.as_view(), name="network-list"),
    path("projects/<uuid:project_pk>/networks/<uuid:pk>/", NetworkDetailView.as_view(), name="network-detail"),

    # Firewalls (project-scoped)
    path("projects/<uuid:project_pk>/firewalls/", FirewallListCreateView.as_view(), name="firewall-list"),
    path("projects/<uuid:project_pk>/firewalls/<uuid:fw_pk>/rules/", FirewallRuleListCreateView.as_view(), name="fw-rule-list"),
    path("projects/<uuid:project_pk>/firewalls/<uuid:fw_pk>/rules/<uuid:pk>/", FirewallRuleDeleteView.as_view(), name="fw-rule-delete"),

    # Reference data
    path("os-templates/", OSTemplateListView.as_view(), name="os-template-list"),
    path("flavors/", FlavorListView.as_view(), name="flavor-list"),
]
