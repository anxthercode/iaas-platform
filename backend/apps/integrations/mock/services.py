import time
import random
import os
import logging
from django.conf import settings
from apps.integrations.base import BaseVMService

logger = logging.getLogger("apps.proxmox.api")

_vmid_counter = 100


def _next_vmid():
    global _vmid_counter
    _vmid_counter += 1
    return _vmid_counter


def _generate_upid(node: str, task_type: str, vmid: int) -> str:
    """Генерирует UPID неотличимый от настоящего Proxmox."""
    pid = random.randint(0x1000, 0xFFFF)
    pstart = random.randint(0x03000000, 0x03FFFFFF)
    starttime = int(time.time())
    user = getattr(settings, "PROXMOX_USER", "root@pam")
    return f"UPID:{node}:{pid:08X}:{pstart:08X}:{starttime:08X}:{task_type}:{vmid}:{user}:"


def _log_api_call(method: str, path: str, params: dict = None, response=None, status=200):
    """Выводит в лог строку, неотличимую от реального Proxmox API вызова."""
    param_str = ""
    if params:
        param_str = " " + str(params)
    logger.info("PROXMOX API  %s %s%s", method, path, param_str)
    if response:
        if isinstance(response, str) and response.startswith("UPID:"):
            logger.info("PROXMOX API  %d %s", status, response)
        else:
            logger.info("PROXMOX API  %d %s", status, response)


def _allocate_ip():
    """Выделяет IP из пула настроек."""
    from apps.compute.models import VirtualMachine
    import ipaddress

    start = getattr(settings, "PROXMOX_IP_POOL_START", "192.168.100.10")
    gateway = getattr(settings, "PROXMOX_IP_GATEWAY", "192.168.100.1")
    start_ip = ipaddress.ip_address(start)
    gw_ip = ipaddress.ip_address(gateway)

    used = set(
        VirtualMachine.objects.exclude(ip_address__isnull=True)
        .exclude(ip_address="")
        .values_list("ip_address", flat=True)
    )

    candidate = start_ip
    for _ in range(254):
        ip_str = str(candidate)
        if ip_str not in used and candidate != gw_ip:
            return ip_str
        candidate = ipaddress.ip_address(int(candidate) + 1)
    return str(start_ip)


class MockVMService(BaseVMService):
    """
    Эмуляция Proxmox VE API.
    Генерирует реалистичные UPID, логи API-вызовов и задержки,
    неотличимые от настоящего взаимодействия с Proxmox.
    """

    NODE = getattr(settings, "PROXMOX_DEFAULT_NODE", "") or "pve"
    TEMPLATE_VMID = getattr(settings, "PROXMOX_TEMPLATE_VMID", 9000)
    STORAGE = getattr(settings, "PROXMOX_DEFAULT_STORAGE", "local-lvm")
    BRIDGE = getattr(settings, "PROXMOX_DEFAULT_BRIDGE", "vmbr0")

    def create(self, vm) -> dict:
        from apps.compute.models import VirtualMachine, HypervisorAccount

        node = self.NODE
        vmid = _next_vmid()
        template = self.TEMPLATE_VMID

        # --- Phase 1: Clone template ---
        vm.power_state = VirtualMachine.PowerState.CREATING
        vm.compute_node = node
        vm.hypervisor_vm_ref = f"{node}/{vmid}"
        account = HypervisorAccount.objects.filter(
            kind__in=[HypervisorAccount.Kind.PROXMOX, HypervisorAccount.Kind.MOCK]
        ).first()
        vm.hypervisor_account = account
        vm.save()

        clone_upid = _generate_upid(node, "qmclone", template)
        _log_api_call(
            "POST",
            f"/api2/json/nodes/{node}/qemu/{template}/clone",
            {"newid": vmid, "name": vm.name, "full": 1, "storage": self.STORAGE},
            clone_upid,
        )

        time.sleep(3)

        _log_api_call(
            "GET",
            f"/api2/json/nodes/{node}/tasks/{clone_upid}/status",
            response={"status": "running", "type": "qmclone", "pid": random.randint(1000, 9999)},
        )
        time.sleep(4)
        _log_api_call(
            "GET",
            f"/api2/json/nodes/{node}/tasks/{clone_upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmclone"},
        )

        # --- Phase 2: Configure cloud-init ---
        vm.power_state = VirtualMachine.PowerState.PROVISIONING
        vm.save()

        ip = _allocate_ip()
        cidr = getattr(settings, "PROXMOX_IP_POOL_CIDR", "24")
        gw = getattr(settings, "PROXMOX_IP_GATEWAY", "192.168.100.1")

        config_params = {
            "cores": vm.vcpu,
            "memory": vm.ram_mb,
            "ipconfig0": f"ip={ip}/{cidr},gw={gw}",
            "ciuser": "ubuntu",
            "net0": f"virtio,bridge={self.BRIDGE}",
        }
        _log_api_call(
            "PUT",
            f"/api2/json/nodes/{node}/qemu/{vmid}/config",
            config_params,
            response=None,
        )

        time.sleep(2)

        # --- Phase 3: Start VM ---
        start_upid = _generate_upid(node, "qmstart", vmid)
        _log_api_call(
            "POST",
            f"/api2/json/nodes/{node}/qemu/{vmid}/status/start",
            response=start_upid,
        )

        time.sleep(3)

        _log_api_call(
            "GET",
            f"/api2/json/nodes/{node}/tasks/{start_upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmstart"},
        )

        vm.ip_address = ip
        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()

        logger.info(
            "VM CREATED  name=%s vmid=%s node=%s ip=%s",
            vm.name, vmid, node, ip,
        )

        return {"upid": start_upid, "node": node, "vmid": vmid}

    def start(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = _generate_upid(node, "qmstart", vmid)

        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/start", response=upid)
        time.sleep(2)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmstart"},
        )

        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def stop(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = _generate_upid(node, "qmshutdown", vmid)

        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/shutdown", response=upid)
        time.sleep(2)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmshutdown"},
        )

        vm.power_state = VirtualMachine.PowerState.STOPPED
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def reboot(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = _generate_upid(node, "qmreboot", vmid)

        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/reboot", response=upid)
        time.sleep(3)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmreboot"},
        )

        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def suspend(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = _generate_upid(node, "qmsuspend", vmid)

        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/suspend", response=upid)
        time.sleep(1.5)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmsuspend"},
        )

        vm.power_state = VirtualMachine.PowerState.SUSPENDED
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def resume(self, vm) -> dict:
        from apps.compute.models import VirtualMachine
        node, vmid = self._parse_ref(vm)
        upid = _generate_upid(node, "qmresume", vmid)

        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/resume", response=upid)
        time.sleep(1.5)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmresume"},
        )

        vm.power_state = VirtualMachine.PowerState.RUNNING
        vm.save()
        return {"upid": upid, "node": node, "vmid": vmid}

    def delete(self, vm) -> dict:
        node, vmid = self._parse_ref(vm)

        stop_upid = _generate_upid(node, "qmstop", vmid)
        _log_api_call("POST", f"/api2/json/nodes/{node}/qemu/{vmid}/status/stop", response=stop_upid)
        time.sleep(1)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{stop_upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmstop"},
        )

        del_upid = _generate_upid(node, "qmdestroy", vmid)
        _log_api_call("DELETE", f"/api2/json/nodes/{node}/qemu/{vmid}", response=del_upid)
        time.sleep(2)
        _log_api_call(
            "GET", f"/api2/json/nodes/{node}/tasks/{del_upid}/status",
            response={"status": "stopped", "exitstatus": "OK", "type": "qmdestroy"},
        )

        return {"upid": del_upid, "node": node, "vmid": vmid}

    def get_status(self, vm) -> dict:
        if not vm.hypervisor_vm_ref:
            return {"status": "unknown"}
        node, vmid = self._parse_ref(vm)
        proxmox_state = {
            "running": "running",
            "stopped": "stopped",
            "suspended": "paused",
            "creating": "stopped",
        }.get(vm.power_state, "stopped")
        return {
            "status": proxmox_state,
            "vmid": vmid,
            "name": vm.name,
            "cpus": vm.vcpu,
            "maxmem": vm.ram_mb * 1024 * 1024,
            "maxdisk": vm.disk_gb * 1024 * 1024 * 1024,
            "netin": random.randint(100000, 9999999),
            "netout": random.randint(100000, 9999999),
            "uptime": random.randint(3600, 864000),
            "pid": random.randint(1000, 30000),
        }

    def _parse_ref(self, vm) -> tuple:
        if vm.hypervisor_vm_ref and "/" in vm.hypervisor_vm_ref:
            node, vmid = vm.hypervisor_vm_ref.split("/", 1)
            return node, int(vmid)
        return self.NODE, _next_vmid()
