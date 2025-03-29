# models.py
from django.db import models


class Session(models.Model):
    session_id = models.CharField(max_length=255, unique=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.session_id


class Score(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="scores")
    total_time = models.FloatField()  # 전체 걸린 시간 (초)
    set1_time = models.FloatField(null=True, blank=True)  # 첫 세트 시간
    set2_time = models.FloatField(null=True, blank=True)  # 두 번째 세트 시간
    success_count = models.IntegerField(default=0)
    average_hold_time = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Session {self.session.session_id} - Score: {self.total_time}"
