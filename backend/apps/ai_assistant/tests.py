import json
from unittest.mock import patch, MagicMock

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .client import DeepSeekClient, DeepSeekAPIError
from .models import ChatSession, ChatMessage

User = get_user_model()

DEEPSEEK_SETTINGS = {
    "DEEPSEEK_API_KEY": "test-key-12345",
    "DEEPSEEK_BASE_URL": "https://api.deepseek.com",
    "DEEPSEEK_MODEL": "deepseek-chat",
}


class DeepSeekClientTests(TestCase):
    """Unit tests for DeepSeekClient with mocked OpenAI SDK."""

    @override_settings(**DEEPSEEK_SETTINGS)
    @patch("apps.ai_assistant.client.OpenAI")
    def test_non_stream_success(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_message = MagicMock()
        mock_message.content = "Test response"
        mock_message.reasoning_content = None

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_usage = MagicMock()
        mock_usage.prompt_tokens = 10
        mock_usage.completion_tokens = 20
        mock_usage.total_tokens = 30

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = mock_usage
        mock_client.chat.completions.create.return_value = mock_response

        client = DeepSeekClient()
        result = client.chat(
            messages=[{"role": "user", "content": "Hello"}],
            stream=False,
        )

        self.assertEqual(result["content"], "Test response")
        self.assertIsNone(result["reasoning_content"])
        self.assertEqual(result["usage"]["total_tokens"], 30)
        mock_client.chat.completions.create.assert_called_once()

    @override_settings(**DEEPSEEK_SETTINGS)
    @patch("apps.ai_assistant.client.OpenAI")
    def test_non_stream_thinking(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_message = MagicMock()
        mock_message.content = "Answer"
        mock_message.reasoning_content = "Thinking steps..."

        mock_choice = MagicMock()
        mock_choice.message = mock_message

        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_response.usage = None
        mock_client.chat.completions.create.return_value = mock_response

        client = DeepSeekClient()
        result = client.chat(
            messages=[{"role": "user", "content": "Think about this"}],
            thinking=True,
        )

        self.assertEqual(result["content"], "Answer")
        self.assertEqual(result["reasoning_content"], "Thinking steps...")

        call_kwargs = mock_client.chat.completions.create.call_args
        self.assertEqual(call_kwargs.kwargs.get("model") or call_kwargs[1].get("model"), "deepseek-reasoner")

    @override_settings(**DEEPSEEK_SETTINGS)
    @patch("apps.ai_assistant.client.OpenAI")
    def test_stream_yields_chunks(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        chunk1 = MagicMock()
        chunk1.choices = [MagicMock()]
        chunk1.choices[0].delta = MagicMock()
        chunk1.choices[0].delta.content = "Hello"
        chunk1.choices[0].delta.reasoning_content = None
        chunk1.choices[0].finish_reason = None

        chunk2 = MagicMock()
        chunk2.choices = [MagicMock()]
        chunk2.choices[0].delta = MagicMock()
        chunk2.choices[0].delta.content = " world"
        chunk2.choices[0].delta.reasoning_content = None
        chunk2.choices[0].finish_reason = "stop"
        chunk2.usage = None

        mock_client.chat.completions.create.return_value = iter([chunk1, chunk2])

        client = DeepSeekClient()
        chunks = list(client.chat(
            messages=[{"role": "user", "content": "Hi"}],
            stream=True,
        ))

        content_chunks = [c for c in chunks if c["type"] == "content"]
        self.assertEqual(len(content_chunks), 2)
        self.assertEqual(content_chunks[0]["delta"], "Hello")
        self.assertEqual(content_chunks[1]["delta"], " world")

    @override_settings(DEEPSEEK_API_KEY="")
    def test_missing_api_key_raises(self):
        with self.assertRaises(ValueError):
            DeepSeekClient()


class ChatEndpointTests(TestCase):
    """Integration tests for /api/ai/chat endpoint with mocked DeepSeek client."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
        )
        self.api_client = APIClient()
        self.api_client.force_authenticate(user=self.user)

    @patch("apps.ai_assistant.views.DeepSeekClient")
    def test_chat_creates_session_and_messages(self, mock_cls):
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        mock_instance.chat.return_value = {
            "content": "Here is my response",
            "reasoning_content": None,
            "usage": {"prompt_tokens": 5, "completion_tokens": 10, "total_tokens": 15},
        }

        resp = self.api_client.post(
            "/api/ai/chat/",
            {"text": "Help me pick an instance"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("session_id", data)
        self.assertEqual(data["assistant"], "Here is my response")

        session = ChatSession.objects.get(id=data["session_id"])
        self.assertEqual(session.user, self.user)
        msgs = session.messages.all()
        self.assertEqual(msgs.count(), 2)
        self.assertEqual(msgs[0].role, "user")
        self.assertEqual(msgs[1].role, "assistant")

    @patch("apps.ai_assistant.views.DeepSeekClient")
    def test_chat_reuses_session(self, mock_cls):
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        mock_instance.chat.return_value = {
            "content": "Response",
            "reasoning_content": None,
            "usage": None,
        }

        session = ChatSession.objects.create(user=self.user)

        resp = self.api_client.post(
            "/api/ai/chat/",
            {"text": "Follow up", "session_id": str(session.id)},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["session_id"], str(session.id))

    @patch("apps.ai_assistant.views.DeepSeekClient")
    def test_chat_with_thinking(self, mock_cls):
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        mock_instance.chat.return_value = {
            "content": "Final answer",
            "reasoning_content": "Step 1... Step 2...",
            "usage": None,
        }

        resp = self.api_client.post(
            "/api/ai/chat/",
            {"text": "Complex question", "thinking": True},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["reasoning_content"], "Step 1... Step 2...")

    def test_chat_unauthenticated(self):
        client = APIClient()
        resp = client.post(
            "/api/ai/chat/",
            {"text": "Hello"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    @patch("apps.ai_assistant.views.DeepSeekClient")
    def test_chat_api_error_429(self, mock_cls):
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        mock_instance.chat.side_effect = DeepSeekAPIError(429, "Rate limit exceeded")

        resp = self.api_client.post(
            "/api/ai/chat/",
            {"text": "Hello"},
            format="json",
        )

        self.assertEqual(resp.status_code, 429)

    @patch("apps.ai_assistant.views.DeepSeekClient")
    def test_stream_returns_sse(self, mock_cls):
        mock_instance = MagicMock()
        mock_cls.return_value = mock_instance
        mock_instance.chat.return_value = iter([
            {"type": "content", "delta": "Hello"},
            {"type": "content", "delta": " world"},
            {"type": "done", "usage": None},
        ])

        resp = self.api_client.post(
            "/api/ai/chat/stream/",
            {"text": "Hi there"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/event-stream")

        content = b"".join(resp.streaming_content).decode()
        self.assertIn('"type": "content"', content)
        self.assertIn("data: [DONE]", content)

    def test_session_list(self):
        ChatSession.objects.create(user=self.user, title="Test session")
        resp = self.api_client.get("/api/ai/sessions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()), 1)

    def test_session_detail(self):
        session = ChatSession.objects.create(user=self.user, title="Test")
        ChatMessage.objects.create(session=session, role="user", content="Hello")
        ChatMessage.objects.create(session=session, role="assistant", content="Hi")

        resp = self.api_client.get(f"/api/ai/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.json()["messages"]), 2)

    def test_session_delete(self):
        session = ChatSession.objects.create(user=self.user)
        resp = self.api_client.delete(f"/api/ai/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(ChatSession.objects.filter(id=session.id).exists())

    def test_session_isolation(self):
        other_user = User.objects.create_user(username="other", email="other@example.com", password="pass123")
        session = ChatSession.objects.create(user=other_user)
        resp = self.api_client.get(f"/api/ai/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 404)
