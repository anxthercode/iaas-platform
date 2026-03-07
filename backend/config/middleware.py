import time
import json
import logging

logger = logging.getLogger("apps.requests")


class RequestLoggingMiddleware:
    """
    Логирует каждый API-запрос:
      → метод, URL, пользователь, тело запроса
      ← статус ответа, время обработки
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Пропускаем статику и admin
        if not request.path.startswith("/api/"):
            return self.get_response(request)

        start = time.time()

        # Тело запроса (только для POST/PUT/PATCH)
        body = ""
        if request.method in ("POST", "PUT", "PATCH"):
            try:
                raw = request.body.decode("utf-8", errors="replace")
                parsed = json.loads(raw)
                # Скрываем пароли
                for key in ("password", "token", "refresh"):
                    if key in parsed:
                        parsed[key] = "***"
                body = f"\n  body: {json.dumps(parsed, ensure_ascii=False)}"
            except Exception:
                body = ""

        # Пользователь
        user_label = "anonymous"
        if hasattr(request, "user") and request.user.is_authenticated:
            user_label = f"{request.user.email}"

        logger.info(
            f"-> %s %s\n  user: %s%s",
            request.method, request.path, user_label, body,
        )

        response = self.get_response(request)

        elapsed = (time.time() - start) * 1000

        # Тело ответа (для ошибок показываем детали)
        resp_body = ""
        if response.status_code >= 400:
            try:
                resp_body = f"\n  response: {response.content.decode('utf-8', errors='replace')[:300]}"
            except Exception:
                pass

        level = logging.INFO if response.status_code < 400 else logging.WARNING
        logger.log(
            level,
            "<- %d %s %s  [%dms]%s",
            response.status_code, request.method, request.path,
            int(elapsed), resp_body,
        )

        return response
