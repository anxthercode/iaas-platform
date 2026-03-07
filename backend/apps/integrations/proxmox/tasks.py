"""
Асинхронные задачи для операций с гипервизором.
Запускаются через threading; при необходимости можно заменить на Celery.
"""
import threading
import logging
from django.utils import timezone

logger = logging.getLogger("apps.integrations.proxmox")


def task_create_vm(vm_id, task_id=None):
    """Фоновая задача: создать VM через адаптер гипервизора."""
    from apps.compute.models import VirtualMachine
    from apps.compute.services import get_vm_service
    from apps.audit.models import Task
    from apps.quotas import services as quota_svc
    from apps.audit import services as audit

    vm = VirtualMachine.objects.select_related("project__tenant").get(id=vm_id)
    task_obj = Task.objects.get(id=task_id) if task_id else None

    if task_obj:
        task_obj.status = Task.Status.RUNNING
        task_obj.started_at = timezone.now()
        task_obj.save()

    service = get_vm_service()
    try:
        result = service.create(vm)
        vm.refresh_from_db()

        if task_obj:
            task_obj.status = Task.Status.SUCCESS
            task_obj.finished_at = timezone.now()
            task_obj.result_payload = {
                "ip_address": vm.ip_address,
                "compute_node": vm.compute_node,
                "hypervisor_ref": vm.hypervisor_vm_ref,
            }
            if result and result.get("upid"):
                task_obj.external_id = result["upid"]
                task_obj.external_node = result.get("node", "")
            task_obj.save()

        audit.log(
            actor_user=task_obj.requested_by if task_obj else None,
            action="vm.created",
            target_kind="vm",
            target_id=vm.pk,
            tenant=vm.project.tenant,
            project=vm.project,
            message=f"ВМ {vm.name} создана → {vm.power_state} IP: {vm.ip_address}",
        )
    except Exception as e:
        logger.exception("task_create_vm failed for VM %s", vm_id)
        vm.power_state = VirtualMachine.PowerState.ERROR
        vm.save()

        tenant = vm.project.tenant
        quota_svc.update_usage(
            tenant,
            vcpu_delta=-vm.vcpu,
            ram_mb_delta=-vm.ram_mb,
            disk_gb_delta=-vm.disk_gb,
            vm_delta=-1,
        )

        if task_obj:
            task_obj.status = Task.Status.FAILED
            task_obj.finished_at = timezone.now()
            task_obj.error_message = str(e)[:1000]
            task_obj.save()


def task_delete_vm(vm_id, task_id=None):
    """Фоновая задача: удалить VM через адаптер гипервизора."""
    from apps.compute.models import VirtualMachine
    from apps.compute.services import get_vm_service
    from apps.audit.models import Task
    from apps.quotas import services as quota_svc
    from apps.audit import services as audit

    vm = VirtualMachine.objects.select_related("project__tenant").get(id=vm_id)
    task_obj = Task.objects.get(id=task_id) if task_id else None
    tenant = vm.project.tenant
    vcpu, ram_mb, disk_gb = vm.vcpu, vm.ram_mb, vm.disk_gb

    if task_obj:
        task_obj.status = Task.Status.RUNNING
        task_obj.started_at = timezone.now()
        task_obj.save()

    service = get_vm_service()
    try:
        result = service.delete(vm)

        if task_obj and result and result.get("upid"):
            task_obj.external_id = result["upid"]
            task_obj.external_node = result.get("node", "")

        quota_svc.update_usage(
            tenant,
            vcpu_delta=-vcpu,
            ram_mb_delta=-ram_mb,
            disk_gb_delta=-disk_gb,
            vm_delta=-1,
        )

        audit.log(
            actor_user=task_obj.requested_by if task_obj else None,
            action="vm.deleted",
            target_kind="vm",
            target_id=vm.pk,
            tenant=tenant,
            message=f"ВМ {vm.name} удалена, ресурсы освобождены",
        )

        vm.delete()

        if task_obj:
            task_obj.status = Task.Status.SUCCESS
            task_obj.finished_at = timezone.now()
            task_obj.save()

    except Exception as e:
        logger.exception("task_delete_vm failed for VM %s", vm_id)
        vm.power_state = VirtualMachine.PowerState.ERROR
        vm.save()

        if task_obj:
            task_obj.status = Task.Status.FAILED
            task_obj.finished_at = timezone.now()
            task_obj.error_message = str(e)[:1000]
            task_obj.save()


def task_vm_action(vm_id, action, task_id=None):
    """Фоновая задача: выполнить действие над VM (start/stop/reboot/suspend/resume)."""
    from apps.compute.models import VirtualMachine
    from apps.compute.services import get_vm_service
    from apps.audit.models import Task
    from apps.audit import services as audit

    vm = VirtualMachine.objects.select_related("project__tenant").get(id=vm_id)
    task_obj = Task.objects.get(id=task_id) if task_id else None

    if task_obj:
        task_obj.status = Task.Status.RUNNING
        task_obj.started_at = timezone.now()
        task_obj.save()

    service = get_vm_service()
    try:
        action_map = {
            "start": service.start,
            "stop": service.stop,
            "reboot": service.reboot,
            "suspend": service.suspend,
            "resume": service.resume,
        }

        fn = action_map.get(action)
        if not fn:
            raise ValueError(f"Unknown action: {action}")

        result = fn(vm)
        vm.refresh_from_db()

        if task_obj:
            task_obj.status = Task.Status.SUCCESS
            task_obj.finished_at = timezone.now()
            if result and result.get("upid"):
                task_obj.external_id = result["upid"]
                task_obj.external_node = result.get("node", "")
            task_obj.result_payload = {"power_state": vm.power_state}
            task_obj.save()

        audit.log(
            actor_user=task_obj.requested_by if task_obj else None,
            action=f"vm.{action}",
            target_kind="vm",
            target_id=vm.pk,
            tenant=vm.project.tenant,
            project=vm.project,
            message=f"ВМ {vm.name}: {action} → {vm.power_state}",
        )

    except Exception as e:
        logger.exception("task_vm_action %s failed for VM %s", action, vm_id)
        if task_obj:
            task_obj.status = Task.Status.FAILED
            task_obj.finished_at = timezone.now()
            task_obj.error_message = str(e)[:1000]
            task_obj.save()


def run_in_thread(fn, *args):
    """Запускает задачу в фоновом потоке."""
    t = threading.Thread(target=fn, args=args, daemon=True)
    t.start()
    return t
