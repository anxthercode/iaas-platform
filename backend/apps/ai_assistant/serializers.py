from rest_framework import serializers
from .models import ChatSession, ChatMessage


class ChatRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField(required=False, allow_null=True)
    text = serializers.CharField(max_length=8000)
    thinking = serializers.BooleanField(default=False)
    model = serializers.CharField(max_length=64, required=False)


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "role", "content", "reasoning_content", "created_at"]


class ChatSessionListSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ["id", "title", "created_at", "updated_at", "last_message", "message_count"]

    def get_last_message(self, obj):
        msg = obj.messages.exclude(role="system").order_by("-created_at").first()
        if msg:
            return {"role": msg.role, "content": msg.content[:120]}
        return None

    def get_message_count(self, obj):
        return obj.messages.exclude(role="system").count()


class ChatSessionDetailSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ["id", "title", "created_at", "updated_at", "messages"]

    def get_messages(self, obj):
        qs = obj.messages.exclude(role="system").order_by("created_at")
        return ChatMessageSerializer(qs, many=True).data
