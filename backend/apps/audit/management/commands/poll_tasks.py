"""
Management command: поллинг незавершённых задач Proxmox по UPID.

Запуск:
    python manage.py poll_tasks              # однократно
    python manage.py poll_tasks --loop       # бесконечный цикл
    python manage.py poll_tasks --loop --interval 10
"""
import time
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger("apps.audit.poll_tasks")


class Command(BaseCommand):
    help = "Поллит незавершённые задачи Proxmox (UPID) и обновляет статусы"

    def add_arguments(self, parser):
        parser.add_argument(
            "--loop", action="store_true",
            help="Запускать в бесконечном цикле",
        )
        parser.add_argument(
            "--interval", type=int,
            default=getattr(settings, "PROXMOX_POLL_INTERVAL", 5),
            help="Интервал между итерациями (секунды)",
        )

    def handle(self, *args, **options):
        loop = options["loop"]
        interval = options["interval"]

        self.stdout.write(self.style.SUCCESS(
            f"poll_tasks: {'loop mode' if loop else 'single run'}, interval={interval}s"
        ))

        while True:
            try:
                processed = self._poll_once()
                if processed:
                    self.stdout.write(f"  обработано задач: {processed}")
            except Exception as e:
                logger.exception("poll_tasks error")
                self.stderr.write(self.style.ERROR(f"Ошибка: {e}"))

            if not loop:
                break
            time.sleep(interval)

    def _poll_once(self) -> int:
        from apps.audit.models import Task

        pending_tasks = Task.objects.filter(
            status__in=[Task.Status.RUNNING, Task.Status.PENDING],
            external_id__gt="",
            external_node__gt="",
        )

        if not pending_tasks.exists():
            return 0

        from apps.integrations.proxmox.client import ProxmoxClient
        client = ProxmoxClient()
        processed = 0

        for task in pending_tasks:
            try:
                self._check_task(client, task)
                processed += 1
            except Exception as e:
                logger.warning("Failed to check task %s: %s", task.id, e)

        return processed

    def _check_task(self, client, task):
        from apps.audit.models import Task
        from apps.compute.models import VirtualMachine

        status = client.get_task_status(task.external_node, task.external_id)
        proxmox_status = status.get("status", "")
        exit_status = status.get("exitstatus", "")

        if proxmox_status != "stopped":
            return

        if exit_status == "OK":
            task.status = Task.Status.SUCCESS
            task.finished_at = timezone.now()
            task.result_payload = task.result_payload or {}
            task.result_payload["proxmox_exit"] = exit_status
            task.save()

            if task.resource_kind == "vm" and task.resource_id:
                self._update_vm_on_success(task)
        else:
            task.status = Task.Status.FAILED
            task.finished_at = timezone.now()
            task.error_message = f"Proxmox task failed: {exit_status}"
            task.save()

            if task.resource_kind == "vm" and task.resource_id:
                try:
                    vm = VirtualMachine.objects.get(id=task.resource_id)
                    if vm.power_state in (
                        VirtualMachine.PowerState.CREATING,
                        VirtualMachine.PowerState.PROVISIONING,
                    ):
                        vm.power_state = VirtualMachine.PowerState.ERROR
                        vm.save()
                except VirtualMachine.DoesNotExist:
                    pass

        logger.info(
            "Task %s [%s]: proxmox=%s exit=%s → %s",
            task.id, task.action, proxmox_status, exit_status, task.status,
        )

    def _update_vm_on_success(self, task):
        """Обновляет состояние VM после успешной задачи Proxmox."""
        from apps.compute.models import VirtualMachine

        action = task.action
        try:
            vm = VirtualMachine.objects.get(id=task.resource_id)
        except VirtualMachine.DoesNotExist:
            return

        state_map = {
            "vm.create": VirtualMachine.PowerState.RUNNING,
            "vm.start": VirtualMachine.PowerState.RUNNING,
            "vm.stop": VirtualMachine.PowerState.STOPPED,
            "vm.reboot": VirtualMachine.PowerState.RUNNING,
            "vm.suspend": VirtualMachine.PowerState.SUSPENDED,
            "vm.resume": VirtualMachine.PowerState.RUNNING,
        }

        new_state = state_map.get(action)
        if new_state and vm.power_state != new_state:
            vm.power_state = new_state
            vm.save()
