import logging
import time
from typing import Generator

from django.conf import settings
from openai import OpenAI, APIError, APIStatusError, APIConnectionError, RateLimitError

logger = logging.getLogger("apps.ai_assistant")

RETRYABLE_STATUS_CODES = {500, 503}
MAX_RETRIES = 3
BASE_BACKOFF = 1.0


def _mask(text: str, visible: int = 4) -> str:
    if not text or len(text) <= visible:
        return "***"
    return text[:visible] + "***"


class DeepSeekClient:
    def __init__(self):
        api_key = getattr(settings, "DEEPSEEK_API_KEY", "")
        base_url = getattr(settings, "DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        if not api_key:
            raise ValueError("DEEPSEEK_API_KEY is not configured")
        logger.debug("DeepSeek client init, base_url=%s, key=%s", base_url, _mask(api_key))
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.default_model = getattr(settings, "DEEPSEEK_MODEL", "deepseek-chat")

    def _build_params(self, messages, model=None, stream=False, thinking=False, **kwargs):
        model = model or self.default_model
        params = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }
        if thinking:
            params["model"] = "deepseek-reasoner"
        params.update(kwargs)
        return params

    def chat(self, messages, model=None, stream=False, thinking=False, **kwargs):
        params = self._build_params(messages, model, stream, thinking, **kwargs)
        if stream:
            return self._stream(params)
        return self._non_stream(params)

    def _non_stream(self, params):
        last_error = None
        for attempt in range(MAX_RETRIES):
            try:
                response = self.client.chat.completions.create(**params)
                choice = response.choices[0] if response.choices else None
                content = ""
                reasoning_content = None
                if choice and choice.message:
                    content = choice.message.content or ""
                    reasoning_content = getattr(choice.message, "reasoning_content", None)
                usage = None
                if response.usage:
                    usage = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens,
                    }
                return {
                    "content": content,
                    "reasoning_content": reasoning_content,
                    "usage": usage,
                }
            except RateLimitError as e:
                raise DeepSeekAPIError(429, "Rate limit exceeded, retry later") from e
            except APIStatusError as e:
                code = e.status_code
                if code == 401:
                    raise DeepSeekAPIError(401, "Invalid API key") from e
                if code == 402:
                    raise DeepSeekAPIError(402, "Недостаточно средств на балансе DeepSeek. Пополните баланс на platform.deepseek.com") from e
                if code == 422:
                    raise DeepSeekAPIError(422, str(e)) from e
                if code in RETRYABLE_STATUS_CODES:
                    last_error = e
                    wait = BASE_BACKOFF * (2 ** attempt)
                    logger.warning("DeepSeek %d error, retry %d/%d in %.1fs", code, attempt + 1, MAX_RETRIES, wait)
                    time.sleep(wait)
                    continue
                raise DeepSeekAPIError(code, str(e)) from e
            except APIError as e:
                last_error = e
                wait = BASE_BACKOFF * (2 ** attempt)
                logger.warning("DeepSeek API error, retry %d/%d in %.1fs: %s", attempt + 1, MAX_RETRIES, wait, e)
                time.sleep(wait)
                continue
            except APIConnectionError as e:
                last_error = e
                wait = BASE_BACKOFF * (2 ** attempt)
                logger.warning("DeepSeek connection error, retry %d/%d in %.1fs", attempt + 1, MAX_RETRIES, wait)
                time.sleep(wait)
                continue

        raise DeepSeekAPIError(503, f"Service unavailable after {MAX_RETRIES} retries: {last_error}")

    def _stream(self, params) -> Generator[dict, None, None]:
        try:
            stream = self.client.chat.completions.create(**params)
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                reasoning = getattr(delta, "reasoning_content", None)
                content = delta.content

                if reasoning:
                    yield {"type": "reasoning", "delta": reasoning}
                if content:
                    yield {"type": "content", "delta": content}

                if chunk.choices[0].finish_reason:
                    usage = None
                    if hasattr(chunk, "usage") and chunk.usage:
                        usage = {
                            "prompt_tokens": chunk.usage.prompt_tokens,
                            "completion_tokens": chunk.usage.completion_tokens,
                            "total_tokens": chunk.usage.total_tokens,
                        }
                    yield {"type": "done", "usage": usage}
        except RateLimitError:
            yield {"type": "error", "message": "Rate limit exceeded, retry later"}
        except APIStatusError as e:
            msg_map = {
                401: "Invalid API key",
                402: "Недостаточно средств на балансе DeepSeek. Пополните баланс на platform.deepseek.com",
            }
            yield {"type": "error", "message": msg_map.get(e.status_code, str(e))}
        except APIError as e:
            yield {"type": "error", "message": str(e)}
        except APIConnectionError:
            yield {"type": "error", "message": "Connection error to DeepSeek API"}


class DeepSeekAPIError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)
