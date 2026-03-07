from django.core.mail import send_mail
from django.conf import settings


def send_credentials_email(email, login, password):
    """Отправка учётных данных после одобрения заявки."""
    send_mail(
        subject="IaaS Platform — Ваши учётные данные",
        message=(
            f"Здравствуйте!\n\n"
            f"Ваша заявка на регистрацию в IaaS Platform одобрена.\n\n"
            f"Логин: {login}\n"
            f"Пароль: {password}\n\n"
            f"При первом входе вам будет предложено сменить пароль.\n\n"
            f"Вход: {settings.FRONTEND_URL}/login\n\n"
            f"С уважением,\nКоманда IaaS-платформы"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )


def send_invite_email(email, tenant_name, temp_password):
    """Приглашение пользователя в тенант."""
    send_mail(
        subject=f"IaaS Platform — Приглашение в {tenant_name}",
        message=(
            f"Здравствуйте!\n\n"
            f"Вы приглашены в организацию «{tenant_name}» на облачной IaaS-платформе.\n\n"
            f"Логин: {email}\n"
            f"Временный пароль: {temp_password}\n\n"
            f"Вход: {settings.FRONTEND_URL}/login\n"
            f"При первом входе смените пароль.\n\n"
            f"С уважением,\nКоманда IaaS-платформы"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )


def send_reset_email(email, reset_link):
    """Ссылка для сброса пароля."""
    send_mail(
        subject="IaaS Platform — Сброс пароля",
        message=(
            f"Здравствуйте!\n\n"
            f"Для вашей учётной записи запрошен сброс пароля.\n\n"
            f"Перейдите по ссылке для установки нового пароля:\n"
            f"{reset_link}\n\n"
            f"Ссылка действительна 24 часа.\n"
            f"Если вы не запрашивали сброс — проигнорируйте это письмо.\n\n"
            f"С уважением,\nКоманда IaaS-платформы"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=True,
    )
