"""
Management command: заполняет БД демо-данными для хакатона.
Использование: python manage.py seed_demo
"""
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.iam.models import User
from apps.tenants.models import Tenant, TenantMember, Project
from apps.compute.models import (
    VirtualMachine, HypervisorAccount, ComputeNode,
    Network, Firewall, FirewallRule, OSTemplate, Flavor,
)
from apps.quotas.models import Quota, UsageCounter
from apps.audit.models import AuditLog


class Command(BaseCommand):
    help = "Заполнить БД демо-данными для IaaS платформы"

    def handle(self, *args, **options):
        self.stdout.write("Начинаю наполнение демо-данными...")

        admin = self._create_admin()
        tenants_data = self._create_tenants()
        users = self._create_users(tenants_data)
        self._create_quotas(tenants_data)
        hyp = self._create_hypervisor()
        self._create_nodes()
        self._create_templates_and_flavors()
        self._create_vms(tenants_data, hyp)
        self._create_networks(tenants_data)
        self._create_audit(admin, tenants_data)

        self.stdout.write(self.style.SUCCESS("Демо-данные успешно созданы!"))

    def _create_admin(self):
        admin, created = User.objects.get_or_create(
            email="admin@iaas.local",
            defaults={
                "username": "admin",
                "full_name": "Администратор Cloud IaaS",
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("admin123")
            admin.save()
            self.stdout.write(f"  Создан admin: admin@iaas.local / admin123")
        else:
            self.stdout.write(f"  Admin admin@iaas.local уже существует")
        return admin

    def _create_tenants(self):
        data = {}
        for name, slug in [("ACME Corp", "acme"), ("Startup Inc", "startup"), ("BigTech Ltd", "bigtech")]:
            tenant, _ = Tenant.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "status": Tenant.Status.ACTIVE},
            )
            project, _ = Project.objects.get_or_create(
                tenant=tenant,
                name=f"{name} — Default VDC",
            )
            data[slug] = {"tenant": tenant, "project": project}
            self.stdout.write(f"  Тенант: {name}")
        return data

    def _create_users(self, tenants_data):
        users_spec = [
            ("aleksei@acme.com", "Алексей Иванов", "acme", "tenant_admin"),
            ("maria@acme.com", "Мария Сидорова", "acme", "tenant_user"),
            ("ivan@startup.com", "Иван Петров", "startup", "tenant_admin"),
            ("elena@bigtech.com", "Елена Козлова", "bigtech", "tenant_admin"),
            ("dmitry@bigtech.com", "Дмитрий Орлов", "bigtech", "tenant_user"),
        ]
        users = []
        for email, full_name, tenant_slug, role in users_spec:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": email.split("@")[0],
                    "full_name": full_name,
                },
            )
            if created:
                user.set_password("user123")
                user.save()

            tenant = tenants_data[tenant_slug]["tenant"]
            TenantMember.objects.get_or_create(
                tenant=tenant, user=user,
                defaults={"role": role},
            )
            users.append(user)
            self.stdout.write(f"  Пользователь: {email} -> {tenant_slug} ({role})")
        return users

    def _create_quotas(self, tenants_data):
        quotas_spec = {
            "acme":    {"cpu_cores": 32, "ram_mb": 65536, "disk_gb": 1000, "vm_count": 20, "public_ip_count": 5},
            "startup": {"cpu_cores": 16, "ram_mb": 32768, "disk_gb": 500,  "vm_count": 10, "public_ip_count": 3},
            "bigtech": {"cpu_cores": 64, "ram_mb": 131072, "disk_gb": 2000, "vm_count": 50, "public_ip_count": 10},
        }
        for slug, limits in quotas_spec.items():
            tenant = tenants_data[slug]["tenant"]
            Quota.objects.get_or_create(tenant=tenant, defaults=limits)
            UsageCounter.objects.get_or_create(tenant=tenant)
            self.stdout.write(f"  Квота для {slug}: {limits}")

    def _create_hypervisor(self):
        from django.conf import settings
        host = getattr(settings, "PROXMOX_HOST", "192.168.1.10")
        hyp, _ = HypervisorAccount.objects.get_or_create(
            name="proxmox-main",
            defaults={
                "kind": HypervisorAccount.Kind.PROXMOX,
                "endpoint": f"https://{host}:8006",
            },
        )
        self.stdout.write(f"  HypervisorAccount: {hyp.name} ({hyp.kind})")
        return hyp

    def _create_nodes(self):
        nodes_spec = [
            ("pve",     "online",  64, 38, 131072, 82000, 2000, 950,  9, "42 days"),
            ("pve-02",  "online",  64, 20, 131072, 56000, 2000, 800,  0, "42 days"),
            ("pve-03",  "online",  32, 6,  65536,  18000, 1000, 150,  0,  "38 days"),
        ]
        for hostname, stat, ct, cu, rt, ru, dt, du, vmc, up in nodes_spec:
            ComputeNode.objects.get_or_create(
                hostname=hostname,
                defaults={
                    "status": stat, "cpu_total": ct, "cpu_used": cu,
                    "ram_total_mb": rt, "ram_used_mb": ru,
                    "disk_total_gb": dt, "disk_used_gb": du,
                    "vm_count": vmc, "uptime": up,
                },
            )
        self.stdout.write(f"  Создано {len(nodes_spec)} нод")

    def _create_templates_and_flavors(self):
        templates = [
            ("Ubuntu 22.04 LTS", "ubuntu-22.04", 10),
            ("Ubuntu 24.04 LTS", "ubuntu-24.04", 10),
            ("CentOS Stream 9", "centos-stream-9", 10),
            ("Debian 12", "debian-12", 10),
            ("Windows Server 2022", "windows-2022", 40),
            ("Astra Linux SE 1.7", "astra-1.7", 15),
        ]
        for name, slug, min_disk in templates:
            OSTemplate.objects.get_or_create(slug=slug, defaults={"name": name, "min_disk_gb": min_disk})
        self.stdout.write(f"  Создано {len(templates)} OS шаблонов")

        flavors = [
            ("small",   1,  2048,   20,  "~39 BYN/мес"),
            ("medium",  2,  4096,   40,  "~78 BYN/мес"),
            ("large",   4,  8192,   80,  "~156 BYN/мес"),
            ("xlarge",  8,  16384,  160, "~312 BYN/мес"),
            ("2xlarge", 16, 32768,  320, "~624 BYN/мес"),
        ]
        for name, vcpu, ram, disk, price in flavors:
            Flavor.objects.get_or_create(
                name=name,
                defaults={"vcpu": vcpu, "ram_mb": ram, "disk_gb": disk, "price_label": price},
            )
        self.stdout.write(f"  Создано {len(flavors)} flavors")

    def _create_vms(self, tenants_data, hyp):
        vms_spec = [
            ("acme", "web-server-01",    "running",  2, 4096,  40,  "medium",  "ubuntu-22.04", "192.168.100.11", "pve", 101),
            ("acme", "db-server-01",     "running",  4, 8192,  160, "large",   "ubuntu-22.04", "192.168.100.12", "pve", 102),
            ("acme", "dev-env",          "stopped",  1, 2048,  20,  "small",   "ubuntu-24.04", "192.168.100.13", "pve", 103),
            ("startup", "app-01",        "running",  2, 4096,  40,  "medium",  "debian-12",    "192.168.100.14", "pve", 104),
            ("startup", "cache-01",      "running",  1, 2048,  20,  "small",   "ubuntu-22.04", "192.168.100.15", "pve", 105),
            ("bigtech", "prod-api-01",   "running",  8, 16384, 160, "xlarge",  "centos-stream-9", "192.168.100.16", "pve", 106),
            ("bigtech", "prod-api-02",   "running",  8, 16384, 160, "xlarge",  "centos-stream-9", "192.168.100.17", "pve", 107),
            ("bigtech", "staging",       "stopped",  4, 8192,  80,  "large",   "ubuntu-24.04", "192.168.100.18", "pve", 108),
            ("bigtech", "monitoring",    "running",  2, 4096,  40,  "medium",  "ubuntu-22.04", "192.168.100.19", "pve", 109),
        ]

        for slug, name, state, vcpu, ram, disk, flav, img, ip, node, vmid in vms_spec:
            project = tenants_data[slug]["project"]
            VirtualMachine.objects.get_or_create(
                project=project, name=name,
                defaults={
                    "power_state": state, "vcpu": vcpu, "ram_mb": ram,
                    "disk_gb": disk, "flavor": flav, "image_ref": img,
                    "ip_address": ip, "compute_node": node,
                    "hypervisor_account": hyp,
                    "hypervisor_vm_ref": f"{node}/{vmid}",
                },
            )

        for slug, td in tenants_data.items():
            tenant = td["tenant"]
            vms = VirtualMachine.objects.filter(project__tenant=tenant)
            usage, _ = UsageCounter.objects.get_or_create(tenant=tenant)
            usage.used_vm_count = vms.count()
            usage.used_cpu_cores = sum(v.vcpu for v in vms)
            usage.used_ram_mb = sum(v.ram_mb for v in vms)
            usage.used_disk_gb = sum(v.disk_gb for v in vms)
            usage.save()

        self.stdout.write(f"  Создано {len(vms_spec)} ВМ + обновлены usage counters")

    def _create_networks(self, tenants_data):
        for slug in tenants_data:
            project = tenants_data[slug]["project"]
            Network.objects.get_or_create(
                project=project, name="default",
                defaults={"cidr": "192.168.100.0/24"},
            )
        self.stdout.write(f"  Создано {len(tenants_data)} сетей")

    def _create_audit(self, admin, tenants_data):
        entries = 0
        for slug, td in tenants_data.items():
            tenant = td["tenant"]
            AuditLog.objects.get_or_create(
                action="tenant.created",
                tenant=tenant,
                actor_user=admin,
                defaults={"message": f"Тенант {tenant.name} создан", "target_kind": "tenant", "target_id": tenant.pk},
            )
            entries += 1
        self.stdout.write(f"  Создано {entries} записей аудит-лога")
