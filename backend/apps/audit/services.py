from .models import AuditLog


def log(
    actor_user,
    action: str,
    target_kind: str = "",
    target_id=None,
    tenant=None,
    project=None,
    message: str = "",
    diff: dict = None,
    request=None,
):
    ip = None
    ua = ""
    if request:
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")[:512]

    AuditLog.objects.create(
        actor_user=actor_user,
        tenant=tenant,
        project=project,
        action=action,
        target_kind=target_kind,
        target_id=target_id,
        message=message,
        diff=diff or {},
        ip_address=ip,
        user_agent=ua,
    )
