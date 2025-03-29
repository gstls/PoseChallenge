
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),        # 홈 화면
    path('pose/', views.pose, name='pose'),     # 포즈 인식 화면
    path('submit_score/', views.submit_score, name='submit_score'),
    path('score/', views.score, name='score'),
    path('get_scores/', views.get_scores, name='get_scores'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

