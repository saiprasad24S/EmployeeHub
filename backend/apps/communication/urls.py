from django.urls import path

from apps.communication.views import (
    CommunicationOverviewView,
    ConversationListCreateView,
    ConversationMessageListView,
    ConversationReadView,
    EmployeeSearchView,
    MessageDeleteView,
    PresenceHeartbeatView,
    TypingStatusView,
    UnreadCountView,
    MessageReactionView,
    GroupListCreateView,
    GroupDetailView,
)

urlpatterns = [
    path("employees/search/", EmployeeSearchView.as_view(), name="communication-employee-search"),
    path("conversations/", ConversationListCreateView.as_view(), name="communication-conversations-list-create"),
    path("conversations/<int:conversation_id>/messages/", ConversationMessageListView.as_view(), name="communication-conversation-messages"),
    path("conversations/<int:conversation_id>/read/", ConversationReadView.as_view(), name="communication-conversation-read"),
    path("conversations/<int:conversation_id>/typing/", TypingStatusView.as_view(), name="communication-conversation-typing"),
    path("messages/<int:message_id>/", MessageDeleteView.as_view(), name="communication-message-delete"),
    path("messages/<int:message_id>/reactions/", MessageReactionView.as_view(), name="communication-message-reactions"),
    path("groups/", GroupListCreateView.as_view(), name="communication-groups-list-create"),
    path("groups/<int:group_id>/", GroupDetailView.as_view(), name="communication-group-detail"),
    path("presence/ping/", PresenceHeartbeatView.as_view(), name="communication-presence-ping"),
    path("unread-count/", UnreadCountView.as_view(), name="communication-unread-count"),
    path("overview/", CommunicationOverviewView.as_view(), name="communication-overview"),
]
