from django.db import transaction

from .models import VirtualMachine, HypervisorAccount, Flavor
from apps.integrations.base import BaseVMService
from apps.integrations.proxmox.tasks import run_in_thread
from apps.quotas import services as quota_svc
from apps.audit import services as audit


def get_vm_service() -> BaseVMService:
    """Фабрика: возвращает нужный адаптер гипервизора.
    Если есть Proxmox-аккаунт — пробует подключиться;
    при неудаче или отсутствии хоста — fallback на MockVMService
    (который генерирует реалистичные Proxmox API логи).
    """
    from django.conf import settings

    account = HypervisorAccount.objects.first()
    if account and account.kind == HypervisorAccount.Kind.PROXMOX:
        proxmox_host = getattr(settings, "PROXMOX_HOST", "")
        proxmox_pass = getattr(settings, "PROXMOX_PASSWORD", "")
        proxmox_token = getattr(settings, "PROXMOX_TOKEN_NAME", "")
        if proxmox_host and (proxmox_pass != "your-proxmox-password" or proxmox_token):
            try:
                from apps.integrations.proxmox.services import ProxmoxVMService
                return ProxmoxVMService()
            except Exception:
                pass

    from apps.integrations.mock.services import MockVMService
    return MockVMService()


def resolve_flavor(flavor_name: str) -> dict:
    """Разрешает flavor-name в ресурсы. Сначала ищет в БД, потом в fallback."""
    try:
        f = Flavor.objects.get(name=flavor_name)
        return {"vcpu": f.vcpu, "ram_mb": f.ram_mb, "disk_gb": f.disk_gb}
    except Flavor.DoesNotExist:
        pass
    FALLBACK = {
        "small":   {"vcpu": 1,  "ram_mb": 2048,  "disk_gb": 20},
        "medium":  {"vcpu": 2,  "ram_mb": 4096,  "disk_gb": 40},
        "large":   {"vcpu": 4,  "ram_mb": 8192,  "disk_gb": 80},
        "xlarge":  {"vcpu": 8,  "ram_mb": 16384, "disk_gb": 160},
        "2xlarge": {"vcpu": 16, "ram_mb": 32768, "disk_gb": 320},
    }
    return FALLBACK.get(flavor_name)


def create_vm(project, name, flavor_name, image_ref="", description="",
              network_id=None, ssh_key="", user=None,
              custom_vcpu=None, custom_ram_mb=None, custom_disk_gb=None) -> dict:
    """
    Создаёт VM: проверяет квоту, резервирует ресурсы, ставит в очередь.
    Возвращает dict с vm и task или error.
    """
    from apps.audit.models import Task

    tenant = project.tenant

    if custom_vcpu and custom_ram_mb and custom_disk_gb:
        vcpu, ram_mb, disk_gb = custom_vcpu, custom_ram_mb, custom_disk_gb
    else:
        lookup = flavor_name if flavor_name != "custom" else "medium"
        specs = resolve_flavor(lookup)
        if not specs:
            return {"error": f"Неизвестный flavor: {flavor_name}"}
        vcpu, ram_mb, disk_gb = specs["vcpu"], specs["ram_mb"], specs["disk_gb"]

    ok, msg = quota_svc.check_quota(tenant, vcpu=vcpu, ram_mb=ram_mb, disk_gb=disk_gb)
    if not ok:
        return {"error": msg}

    with transaction.atomic():
        vm = VirtualMachine.objects.create(
            name=name,
            description=description,
            project=project,
            vcpu=vcpu,
            ram_mb=ram_mb,
            disk_gb=disk_gb,
            flavor=flavor_name,
            image_ref=image_ref,
            ssh_key=ssh_key,
            power_state=VirtualMachine.PowerState.CREATING,
        )

        if network_id:
            from .models import Network
            try:
                net = Network.objects.get(id=network_id, project=project)
                vm.primary_network = net
                vm.save()
            except Network.DoesNotExist:
                pass

        task = Task.objects.create(
            tenant=tenant,
            project=project,
            requested_by=user,
            action="vm.create",
            status=Task.Status.PENDING,
            resource_kind="vm",
            resource_id=vm.pk,
            request_payload={
                "name": name, "flavor": flavor_name, "image": image_ref,
                "vcpu": vcpu, "ram_mb": ram_mb, "disk_gb": disk_gb,
            },
        )

        quota_svc.update_usage(tenant, vcpu_delta=vcpu, ram_mb_delta=ram_mb,
                               disk_gb_delta=disk_gb, vm_delta=1)

    from apps.integrations.proxmox.tasks import task_create_vm
    run_in_thread(task_create_vm, vm.id, task.id)

    return {"vm": vm, "task": task}


def _do_vm_action(vm_id, action, user=None) -> VirtualMachine:
    """Общий метод для выполнения действия над VM через Task."""
    from apps.audit.models import Task
    from apps.integrations.proxmox.tasks import task_vm_action

    vm = VirtualMachine.objects.select_related("project__tenant").get(id=vm_id)
    task = Task.objects.create(
        tenant=vm.project.tenant,
        project=vm.project,
        requested_by=user,
        action=f"vm.{action}",
        status=Task.Status.PENDING,
        resource_kind="vm",
        resource_id=vm.pk,
    )
    run_in_thread(task_vm_action, vm.id, action, task.id)
    return vm


def start_vm(vm_id, user=None) -> VirtualMachine:
    return _do_vm_action(vm_id, "start", user)


def stop_vm(vm_id, user=None) -> VirtualMachine:
    return _do_vm_action(vm_id, "stop", user)


def reboot_vm(vm_id, user=None) -> VirtualMachine:
    return _do_vm_action(vm_id, "reboot", user)


def pause_vm(vm_id, user=None) -> VirtualMachine:
    return _do_vm_action(vm_id, "suspend", user)


def resume_vm(vm_id, user=None) -> VirtualMachine:
    return _do_vm_action(vm_id, "resume", user)


def delete_vm(vm_id, user=None) -> None:
    from apps.audit.models import Task
    from apps.integrations.proxmox.tasks import task_delete_vm

    vm = VirtualMachine.objects.select_related("project__tenant").get(id=vm_id)
    vm.power_state = VirtualMachine.PowerState.DELETING
    vm.save()

    task = Task.objects.create(
        tenant=vm.project.tenant,
        project=vm.project,
        requested_by=user,
        action="vm.delete",
        status=Task.Status.PENDING,
        resource_kind="vm",
        resource_id=vm.pk,
    )

    run_in_thread(task_delete_vm, vm.id, task.id)
