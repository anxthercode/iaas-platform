import logging
from django.conf import settings

logger = logging.getLogger("apps.integrations.proxmox")


class ProxmoxClient:
    """Клиент для Proxmox VE API через proxmoxer.
    Поддерживает аутентификацию по паролю и API Token.
    """

    def __init__(self):
        self._proxmox = None

    def _get_connection(self):
        if self._proxmox is None:
            from proxmoxer import ProxmoxAPI

            token_name = getattr(settings, "PROXMOX_TOKEN_NAME", "")
            token_value = getattr(settings, "PROXMOX_TOKEN_VALUE", "")

            if token_name and token_value:
                self._proxmox = ProxmoxAPI(
                    settings.PROXMOX_HOST,
                    user=settings.PROXMOX_USER,
                    token_name=token_name,
                    token_value=token_value,
                    verify_ssl=settings.PROXMOX_VERIFY_SSL,
                )
                logger.info("Proxmox: connected via API Token")
            else:
                self._proxmox = ProxmoxAPI(
                    settings.PROXMOX_HOST,
                    user=settings.PROXMOX_USER,
                    password=settings.PROXMOX_PASSWORD,
                    verify_ssl=settings.PROXMOX_VERIFY_SSL,
                )
                logger.info("Proxmox: connected via password")
        return self._proxmox

    # ── Nodes ──

    def get_nodes(self) -> list:
        return self._get_connection().nodes.get()

    def pick_node(self) -> str:
        """Возвращает ноду с максимумом свободной RAM, или PROXMOX_DEFAULT_NODE."""
        default = getattr(settings, "PROXMOX_DEFAULT_NODE", "")
        if default:
            return default
        nodes = self.get_nodes()
        if not nodes:
            return "pve"
        best = max(nodes, key=lambda n: n.get("maxmem", 0) - n.get("mem", 0))
        return best["node"]

    # ── VMID ──

    def get_next_vmid(self) -> int:
        return int(self._get_connection().cluster.nextid.get())

    # ── Clone from template ──

    def clone_vm(self, node: str, template_vmid: int, newid: int, name: str,
                 full: bool = True, storage: str = "") -> str:
        """Клонирует VM из шаблона. Возвращает UPID."""
        params = {
            "newid": newid,
            "name": name,
            "full": 1 if full else 0,
        }
        if storage:
            params["storage"] = storage
        upid = self._get_connection().nodes(node).qemu(template_vmid).clone.post(**params)
        logger.info("clone_vm: node=%s template=%s newid=%s upid=%s", node, template_vmid, newid, upid)
        return upid

    def configure_vm(self, node: str, vmid: int, *,
                     cores: int = 0, memory_mb: int = 0, sockets: int = 1,
                     ciuser: str = "", cipassword: str = "", sshkeys: str = "",
                     ipconfig0: str = "", nameserver: str = "",
                     net0: str = "") -> None:
        """Настраивает VM (cloud-init, ресурсы)."""
        params = {}
        if cores:
            params["cores"] = cores
        if memory_mb:
            params["memory"] = memory_mb
        if sockets > 1:
            params["sockets"] = sockets
        if ciuser:
            params["ciuser"] = ciuser
        if cipassword:
            params["cipassword"] = cipassword
        if sshkeys:
            import urllib.parse
            params["sshkeys"] = urllib.parse.quote(sshkeys, safe="")
        if ipconfig0:
            params["ipconfig0"] = ipconfig0
        if nameserver:
            params["nameserver"] = nameserver
        if net0:
            params["net0"] = net0
        if params:
            self._get_connection().nodes(node).qemu(vmid).config.put(**params)
            logger.info("configure_vm: node=%s vmid=%s params=%s", node, vmid, list(params.keys()))

    # ── Create from scratch (fallback) ──

    def create_vm(self, node: str, vmid: int, name: str,
                  cores: int, memory_mb: int, disk_gb: int) -> str:
        """Создаёт VM с нуля. Возвращает UPID."""
        storage = getattr(settings, "PROXMOX_DEFAULT_STORAGE", "local-lvm")
        bridge = getattr(settings, "PROXMOX_DEFAULT_BRIDGE", "vmbr0")
        upid = self._get_connection().nodes(node).qemu.post(
            vmid=vmid,
            name=name,
            cores=cores,
            memory=memory_mb,
            scsihw="virtio-scsi-pci",
            scsi0=f"{storage}:{disk_gb}",
            net0=f"virtio,bridge={bridge}",
            ostype="l26",
        )
        logger.info("create_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    # ── Power actions — все возвращают UPID ──

    def start_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).status.start.post()
        logger.info("start_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    def stop_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).status.stop.post()
        logger.info("stop_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    def shutdown_vm(self, node: str, vmid: int) -> str:
        """ACPI shutdown (graceful)."""
        upid = self._get_connection().nodes(node).qemu(vmid).status.shutdown.post()
        logger.info("shutdown_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    def reboot_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).status.reboot.post()
        logger.info("reboot_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    def suspend_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).status.suspend.post()
        logger.info("suspend_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    def resume_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).status.resume.post()
        logger.info("resume_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    # ── Delete ──

    def delete_vm(self, node: str, vmid: int) -> str:
        upid = self._get_connection().nodes(node).qemu(vmid).delete()
        logger.info("delete_vm: node=%s vmid=%s upid=%s", node, vmid, upid)
        return upid

    # ── Status ──

    def get_vm_status(self, node: str, vmid: int) -> dict:
        return self._get_connection().nodes(node).qemu(vmid).status.current.get()

    def get_vms(self, node: str) -> list:
        return self._get_connection().nodes(node).qemu.get()

    # ── Task (UPID) polling ──

    def get_task_status(self, node: str, upid: str) -> dict:
        """Возвращает {'status': 'running'|'stopped', 'exitstatus': 'OK'|...}."""
        return self._get_connection().nodes(node).tasks(upid).status.get()

    def get_task_log(self, node: str, upid: str, start: int = 0, limit: int = 50) -> list:
        return self._get_connection().nodes(node).tasks(upid).log.get(start=start, limit=limit)

    def wait_for_task(self, node: str, upid: str, timeout: int = 120, interval: int = 2) -> dict:
        """Блокирующее ожидание завершения задачи Proxmox."""
        import time
        deadline = time.time() + timeout
        while time.time() < deadline:
            status = self.get_task_status(node, upid)
            if status.get("status") == "stopped":
                return status
            time.sleep(interval)
        raise TimeoutError(f"Proxmox task {upid} не завершилась за {timeout}s")
