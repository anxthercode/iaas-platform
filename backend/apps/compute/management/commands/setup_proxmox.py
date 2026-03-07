from django.core.management.base import BaseCommand
from django.conf import settings
from apps.compute.models import HypervisorAccount


class Command(BaseCommand):
    help = "Создаёт или обновляет запись HypervisorAccount для Proxmox из переменных окружения"

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Проверить подключение к Proxmox после создания записи",
        )

    def handle(self, *args, **options):
        host = settings.PROXMOX_HOST
        user = settings.PROXMOX_USER
        token_name = getattr(settings, "PROXMOX_TOKEN_NAME", "")

        if not host:
            self.stderr.write(self.style.ERROR(
                "PROXMOX_HOST не задан в .env. Добавьте его и повторите."
            ))
            return

        auth_method = f"API Token ({token_name})" if token_name else "Password"

        account, created = HypervisorAccount.objects.update_or_create(
            name="proxmox-main",
            defaults={
                "kind": HypervisorAccount.Kind.PROXMOX,
                "endpoint": f"https://{host}:8006",
                "token": "",
            },
        )

        action = "Создан" if created else "Обновлён"
        self.stdout.write(self.style.SUCCESS(
            f"{action} HypervisorAccount: {account.name} "
            f"(id={account.id}, endpoint={account.endpoint}, "
            f"user={user}, auth={auth_method})"
        ))

        template_vmid = getattr(settings, "PROXMOX_TEMPLATE_VMID", 9000)
        storage = getattr(settings, "PROXMOX_DEFAULT_STORAGE", "local-lvm")
        bridge = getattr(settings, "PROXMOX_DEFAULT_BRIDGE", "vmbr0")
        self.stdout.write(
            f"  Template VMID: {template_vmid}\n"
            f"  Storage: {storage}\n"
            f"  Bridge: {bridge}"
        )

        if options["check"]:
            self.stdout.write("\nПроверяю подключение к Proxmox...")
            try:
                from apps.integrations.proxmox.client import ProxmoxClient
                client = ProxmoxClient()
                nodes = client.get_nodes()
                self.stdout.write(self.style.SUCCESS(
                    f"Подключение успешно! Найдено нод: {len(nodes)}"
                ))
                for node in nodes:
                    mem_free_gb = (node.get("maxmem", 0) - node.get("mem", 0)) / 1024 ** 3
                    cpu_count = node.get("maxcpu", "?")
                    self.stdout.write(
                        f"  - {node['node']}: CPU={cpu_count} "
                        f"RAM свободно={mem_free_gb:.1f} GB "
                        f"статус={node.get('status', '?')}"
                    )

                next_vmid = client.get_next_vmid()
                self.stdout.write(f"  Следующий свободный VMID: {next_vmid}")

                try:
                    best_node = nodes[0]["node"] if nodes else "pve"
                    vms = client.get_vms(best_node)
                    templates = [v for v in vms if v.get("template", 0) == 1]
                    self.stdout.write(f"  Шаблонов на {best_node}: {len(templates)}")
                    for t in templates:
                        self.stdout.write(
                            f"    VMID={t['vmid']} name={t.get('name', '?')}"
                        )
                except Exception:
                    pass

            except Exception as exc:
                self.stderr.write(self.style.WARNING(
                    f"Не удалось подключиться к Proxmox: {exc}\n"
                    "Проверьте PROXMOX_HOST, PROXMOX_USER, PROXMOX_PASSWORD "
                    "(или PROXMOX_TOKEN_NAME/PROXMOX_TOKEN_VALUE) в .env"
                ))
