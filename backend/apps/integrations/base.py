class BaseVMService:
    """Abstract interface for hypervisor VM operations."""

    def create(self, vm) -> dict:
        """Returns {'upid': ..., 'node': ..., 'vmid': ...} or empty dict for mock."""
        raise NotImplementedError

    def start(self, vm) -> dict:
        raise NotImplementedError

    def stop(self, vm) -> dict:
        raise NotImplementedError

    def reboot(self, vm) -> dict:
        raise NotImplementedError

    def suspend(self, vm) -> dict:
        raise NotImplementedError

    def resume(self, vm) -> dict:
        raise NotImplementedError

    def delete(self, vm) -> dict:
        raise NotImplementedError

    def get_status(self, vm) -> dict:
        raise NotImplementedError
