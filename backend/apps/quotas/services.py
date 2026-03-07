from .models import Quota, UsageCounter


def check_quota(tenant, vcpu=0, ram_mb=0, disk_gb=0, vm_count=1):
    """Проверяет, не превышает ли создание ресурса квоты тенанта."""
    try:
        quota = tenant.quota
    except Quota.DoesNotExist:
        return False, "Квота не установлена для тенанта"

    usage, _ = UsageCounter.objects.get_or_create(tenant=tenant)

    if usage.used_vm_count + vm_count > quota.vm_count:
        return False, f"Превышен лимит ВМ ({quota.vm_count})"
    if usage.used_cpu_cores + vcpu > quota.cpu_cores:
        return False, f"Превышен лимит vCPU ({quota.cpu_cores})"
    if usage.used_ram_mb + ram_mb > quota.ram_mb:
        return False, f"Превышен лимит RAM ({quota.ram_mb} MB)"
    if usage.used_disk_gb + disk_gb > quota.disk_gb:
        return False, f"Превышен лимит диска ({quota.disk_gb} GB)"

    return True, "OK"


def update_usage(tenant, vcpu_delta=0, ram_mb_delta=0, disk_gb_delta=0, vm_delta=0):
    """Обновляет счётчик использования ресурсов."""
    usage, _ = UsageCounter.objects.get_or_create(tenant=tenant)
    usage.used_cpu_cores = max(0, usage.used_cpu_cores + vcpu_delta)
    usage.used_ram_mb = max(0, usage.used_ram_mb + ram_mb_delta)
    usage.used_disk_gb = max(0, usage.used_disk_gb + disk_gb_delta)
    usage.used_vm_count = max(0, usage.used_vm_count + vm_delta)
    usage.save()
