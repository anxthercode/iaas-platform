from django.urls import path
from . import views

urlpatterns = [
    path("chat/", views.ChatView.as_view(), name="ai-chat"),
    path("chat/stream/", views.ChatStreamView.as_view(), name="ai-chat-stream"),
    path("analytics/stream/", views.AnalyticsChatStreamView.as_view(), name="ai-analytics-stream"),
    path("sessions/", views.SessionListView.as_view(), name="ai-sessions"),
    path("sessions/<uuid:pk>/", views.SessionDetailView.as_view(), name="ai-session-detail"),
]
