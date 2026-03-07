import uuid
from django.db import models


class HypervisorAccount(models.Model):
    """Подключение к бэкенду гипервизора (Proxmox или mock)."""

    class Kind(models.TextChoices):
        PROXMOX = "proxmox", "Proxmox VE"
        MOCK = "mock", "Mock (тестовый)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128, unique=True)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.MOCK)
    endpoint = models.CharField(max_length=256, blank=True)
    token = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hypervisor_accounts"

    def __str__(self):
        return f"{self.name} ({self.kind})"


class Network(models.Model):
    """Сети проекта."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "tenants.Project", on_delete=models.CASCADE, related_name="networks"
    )
    name = models.CharField(max_length=128)
    cidr = models.CharField(max_length=18, blank=True)  # e.g. 10.0.0.0/24
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "networks"
        unique_together = [("project", "name")]

    def __str__(self):
        return f"{self.name} ({self.cidr})"


class VirtualMachine(models.Model):
    """Виртуальные машины."""

    class PowerState(models.TextChoices):
        STOPPED = "stopped", "Остановлена"
        RUNNING = "running", "Работает"
        SUSPENDED = "suspended", "Приостановлена"
        CREATING = "creating", "Создаётся"
        PROVISIONING = "provisioning", "Подготовка"
        ERROR = "error", "Ошибка"
        DELETING = "deleting", "Удаляется"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "tenants.Project", on_delete=models.CASCADE, related_name="vms"
    )
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)

    vcpu = models.PositiveSmallIntegerField(default=2)
    ram_mb = models.PositiveIntegerField(default=2048)
    disk_gb = models.PositiveIntegerField(default=20)
    flavor = models.CharField(max_length=32, blank=True)

    power_state = models.CharField(
        max_length=16, choices=PowerState.choices, default=PowerState.CREATING
    )
    image_ref = models.CharField(max_length=128, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    ssh_key = models.TextField(blank=True)

    primary_network = models.ForeignKey(
        Network, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    hypervisor_account = models.ForeignKey(
        HypervisorAccount, null=True, blank=True, on_delete=models.SET_NULL
    )
    hypervisor_vm_ref = models.CharField(max_length=128, blank=True)
    compute_node = models.CharField(max_length=128, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vms"
        unique_together = [("project", "name")]

    def __str__(self):
        return f"{self.name} [{self.power_state}]"


class Disk(models.Model):
    """Диски/тома."""

    class Status(models.TextChoices):
        AVAILABLE = "available", "Доступен"
        IN_USE = "in-use", "Используется"
        ERROR = "error", "Ошибка"
        CREATING = "creating", "Создаётся"
        DELETING = "deleting", "Удаляется"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "tenants.Project", on_delete=models.CASCADE, related_name="disks"
    )
    name = models.CharField(max_length=128)
    size_gb = models.PositiveIntegerField(default=20)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.CREATING
    )
    attached_vm = models.ForeignKey(
        VirtualMachine, null=True, blank=True, on_delete=models.SET_NULL, related_name="disks"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "disks"
        unique_together = [("project", "name")]

    def __str__(self):
        return f"{self.name} ({self.size_gb} GB, {self.status})"


class VMNetworkAttachment(models.Model):
    """Подключения VM к сетям (VM может быть в нескольких сетях)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vm = models.ForeignKey(VirtualMachine, on_delete=models.CASCADE, related_name="network_attachments")
    network = models.ForeignKey(Network, on_delete=models.CASCADE, related_name="vm_attachments")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vm_network_attachments"
        unique_together = [("vm", "network")]

    def __str__(self):
        return f"{self.vm.name} → {self.network.name} ({self.ip_address})"


class Firewall(models.Model):
    """Firewall-объекты проекта (Security Groups)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        "tenants.Project", on_delete=models.CASCADE, related_name="firewalls"
    )
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "firewalls"
        unique_together = [("project", "name")]

    def __str__(self):
        return self.name


class FirewallRule(models.Model):
    """Правила firewall."""

    class Direction(models.TextChoices):
        INGRESS = "ingress", "Входящий"
        EGRESS = "egress", "Исходящий"

    class Protocol(models.TextChoices):
        TCP = "tcp", "TCP"
        UDP = "udp", "UDP"
        ICMP = "icmp", "ICMP"
        ANY = "any", "Любой"

    class Action(models.TextChoices):
        ALLOW = "allow", "Разрешить"
        DENY = "deny", "Запретить"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firewall = models.ForeignKey(Firewall, on_delete=models.CASCADE, related_name="rules")
    direction = models.CharField(max_length=8, choices=Direction.choices)
    protocol = models.CharField(max_length=8, choices=Protocol.choices, default=Protocol.TCP)
    port_range = models.CharField(max_length=32, blank=True, null=True)  # "22" или "80-443"
    remote_cidr = models.CharField(max_length=18, default="0.0.0.0/0")
    action = models.CharField(max_length=8, choices=Action.choices, default=Action.ALLOW)
    priority = models.PositiveSmallIntegerField(default=100)
    description = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "firewall_rules"
        ordering = ["priority"]

    def __str__(self):
        return f"{self.action.upper()} {self.protocol} {self.port_range or '*'} ({self.direction})"


class FirewallBinding(models.Model):
    """
    Привязка firewall к VM или сети.
    Ровно одно из vm/network должно быть заполнено.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    firewall = models.ForeignKey(Firewall, on_delete=models.CASCADE, related_name="bindings")
    vm = models.ForeignKey(
        VirtualMachine, null=True, blank=True, on_delete=models.CASCADE, related_name="firewall_bindings"
    )
    network = models.ForeignKey(
        Network, null=True, blank=True, on_delete=models.CASCADE, related_name="firewall_bindings"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "firewall_bindings"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(vm__isnull=False, network__isnull=True) |
                    models.Q(vm__isnull=True, network__isnull=False)
                ),
                name="fw_binding_vm_xor_network",
            )
        ]

    def __str__(self):
        target = self.vm or self.network
        return f"{self.firewall.name} → {target}"


class ComputeNode(models.Model):
    """Физические/виртуальные ноды гипервизора."""

    class Status(models.TextChoices):
        ONLINE = "online", "Online"
        OFFLINE = "offline", "Offline"
        MAINTENANCE = "maintenance", "Maintenance"
        DRAINING = "draining", "Draining"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    hostname = models.CharField(max_length=128, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ONLINE)
    cpu_total = models.PositiveIntegerField(default=64)
    cpu_used = models.PositiveIntegerField(default=0)
    ram_total_mb = models.PositiveIntegerField(default=131072)
    ram_used_mb = models.PositiveIntegerField(default=0)
    disk_total_gb = models.PositiveIntegerField(default=2000)
    disk_used_gb = models.PositiveIntegerField(default=0)
    vm_count = models.PositiveIntegerField(default=0)
    uptime = models.CharField(max_length=64, blank=True)
    hypervisor_account = models.ForeignKey(
        HypervisorAccount, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="nodes",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "compute_nodes"

    def __str__(self):
        return f"{self.hostname} [{self.status}]"


class OSTemplate(models.Model):
    """Шаблоны ОС для создания ВМ."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=128)
    slug = models.SlugField(max_length=64, unique=True)
    min_disk_gb = models.PositiveIntegerField(default=10)
    is_public = models.BooleanField(default=True)

    class Meta:
        db_table = "os_templates"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Flavor(models.Model):
    """Конфигурации ресурсов (flavors) для ВМ."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=32, unique=True)
    vcpu = models.PositiveSmallIntegerField()
    ram_mb = models.PositiveIntegerField()
    disk_gb = models.PositiveIntegerField()
    price_label = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "flavors"
        ordering = ["vcpu", "ram_mb"]

    def __str__(self):
        return f"{self.name} ({self.vcpu}vCPU/{self.ram_mb}MB/{self.disk_gb}GB)"
