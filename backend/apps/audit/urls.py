from django.urls import path
from .views import AuditLogListView, TaskListView, TaskDetailView

urlpatterns = [
    path("", AuditLogListView.as_view(), name="audit-list"),
    path("tasks/", TaskListView.as_view(), name="task-list"),
    path("tasks/<uuid:pk>/", TaskDetailView.as_view(), name="task-detail"),
]
