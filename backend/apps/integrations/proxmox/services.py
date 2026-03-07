import ipaddress
import logging
from django.conf import settings
from apps.integrations.base import BaseVMService
from .client import ProxmoxClient

logger = logging.getLogger("apps.integrations.proxmox")

_client = ProxmoxClient()


def _allocate_ip() -> str:
    """Простой IPAM: берёт следующий свободный IP из пула.
    Проверяет, какие IP уже заняты в БД, и выдаёт первый свободный.
    """
    from apps.compute.models import VirtualMachine

    start_ip = ipaddress.ip_address(settings.PROXMOX_IP_POOL_START)
    gateway = ipaddress.ip_address(settings.PROXMOX_IP_GATEWAY)
    used_ips = set(
        VirtualMachine.objects.exclude(ip_address__isnull=True)
        .exclude(ip_address="")
        .values_list("ip_address", flat=True)
    )

    candidate = start_ip
    for _ in range(254):
        ip_str = str(candidate)
        if ip_str not in used_ips and candidate != gateway:
            return ip_str
        candidate = ipaddress.ip_address(int(candidate) + 1)

    return str(start_ip)


class ProxmoxVMService(BaseVMService):
    """Сервис для управления VM через Proxmox API.
    Поддерживает клонирование из шаблона, cloud-init, UPID-поллинг.
    """

    def __init__(self):
        self.client = _client

    def _parse_ref(self, vm) -> tuple:
        """Извлекает (node, vmid) из hypervisor_vm_ref вида 'node/vmid'."""
        if not vm.hypervisor_vm_ref or "/" not in vm.hypervisor_vm_ref:
            raise ValueError(f"VM {vm.id} не имеет hypervisor_vm_ref")
        node, vmid = vm.hypervisor_vm_ref.split("/", 1)
        return node, int(vmid)

    def _get_hypervisor_account(self):
        from apps.compute.models import HypervisorAccount
        return HypervisorAccount.objects.filter(
            kind=HypervisorAccount.Kind.PROXMOX
        ).first()

    def create(self, vm) -> dict:
        """Клонирует VM из шаблона, настраивает cloud-init, запускает.
        Возвращает {'upid': str, 'node': str, 'vmid': int}.
        """
        from apps.compute.models import VirtualMachine

        template_vmid = settings.PROXMOX_TEMPLATE_VMID
        node = self.client.pick_node()
        vmid = self.client.get_next_vmid()
        storage = settings.PROXMOX_DEFAULT_STORAGE
        bridge = settings.PROXMOX_DEFAULT_BRIDGE

        vm.power_state = VirtualMachine.PowerState.CREATING
        vm.compute_node = node
        vm.hypervisor_vm_ref = f"{node}/{vmid}"
        vm.hypervisor_account = self._get_hypervisor_account()
        vm.save()

        clone_upid = self.client.clone_vm(
            node=node,
            template_vmid=template_vmid,
            newid=vmid,
            name=vm.name,
            full=True,
            storage=storage,
        )

        result = self.client.wait_for_task(node, clone_upid, timeout=300, interval=3)
        if result.get("exitstatus") != "OK":
            raise RuntimeError(f"Clone failed: {result}")

        vm.power_state = VirtualMachine.PowerState.PROVISIONING
        vm.save()

        ip = _allocate_ip()
        cidr = settings.PROXMOX_IP_POOL_CIDR
        gw = settings.PROXMOX_IP_GATEWAY

        config_params = {
            "cores": vm.vcpu,
            "memory_mb": vm.ram_mb,
            "ipconfig0": f"ip={ip}/{cidr},gw={gw}",
            "net0": f"virtio,bridge={bridge}",
            "ciuser": "ubuntu",
        }
        if vm.ssh_key:
            config_params["sshkeys"] = vm.ssh_key

        self.client.configure_vm(node, vmid, **config_params)

        start_upid = self.client.start_vm(node, vmid)

        vm.ip_address = ip
        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()

        logger.info("VM %s created: node=%s vmid=%s ip=%s", vm.name, node, vmid, ip)
        return {"upid": start_upid, "node": node, "vmid": vmid}

    def start(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = self.client.start_vm(node, vmid)
        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def stop(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = self.client.shutdown_vm(node, vmid)
        vm.power_state = VirtualMachine.PowerState.STOPPED
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def reboot(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = self.client.reboot_vm(node, vmid)
        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def suspend(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = self.client.suspend_vm(node, vmid)
        vm.power_state = VirtualMachine.PowerState.SUSPENDED
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def resume(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = self.client.resume_vm(node, vmid)
        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def delete(self, vm) -> dict:
        if not vm.hypervisor_vm_ref:
            return {}
        node, vmid = self._parse_ref(vm)

        try:
            status = self.client.get_vm_status(node, vmid)
            if status.get("status") == "running":
                stop_upid = self.client.stop_vm(node, vmid)
                self.client.wait_for_task(node, stop_upid, timeout=60)
        except Exception as e:
            logger.warning("Pre-delete stop failed for VM %s: %s", vm.id, e)

        upid = self.client.delete_vm(node, vmid)
        return {"upid": upid, "node": node, "vmid": vmid}

    def get_status(self, vm) -> dict:
        if not vm.hypervisor_vm_ref:
            return {"status": "unknown"}
        node, vmid = self._parse_ref(vm)
        return self.client.get_vm_status(node, vmid)
