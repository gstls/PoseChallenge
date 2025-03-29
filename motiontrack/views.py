# views.py
from django.shortcuts import render, redirect
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Score, Session
import json


def home(request):
    return render(request, 'home.html')


def pose(request):
    return render(request, 'pose.html')


@csrf_exempt
def submit_score(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            total_time = float(data.get("score"))
        except (TypeError, ValueError, json.JSONDecodeError):
            return JsonResponse({"error": "Invalid score value"}, status=400)

        # 추가 정보가 필요한 경우 아래에서 처리 가능 (set1_time, set2_time, 등)
        set1_time = data.get("set1_time")
        set2_time = data.get("set2_time")
        success_count = int(data.get("success_count", 0))
        average_hold_time = data.get("average_hold_time")

        session_key = request.session.session_key
        if not session_key:
            request.session.create()
            session_key = request.session.session_key

        ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        session_obj, created = Session.objects.get_or_create(
            session_id=session_key,
            defaults={
                'start_time': timezone.now(),
                'ip_address': ip,
                'user_agent': user_agent,
            }
        )

        Score.objects.create(
            session=session_obj,
            total_time=total_time,
            set1_time=set1_time if set1_time else None,
            set2_time=set2_time if set2_time else None,
            success_count=success_count,
            average_hold_time=average_hold_time if average_hold_time else None
        )

        # POST 요청에 대한 JSON 응답으로 score 페이지 URL 반환
        return JsonResponse({"status": "success", "redirect_url": "/score/"})
    else:
        return JsonResponse({"error": "Invalid request method"}, status=400)


def score(request):
    # DB에서 총 걸린 시간(total_time)이 낮은 순으로 상위 10개 점수를 조회하여 score.html로 전달
    scores = Score.objects.all().order_by('total_time')[:10]
    return render(request, 'score.html', {'scores': scores})


def get_scores(request):
    # Ajax를 위한 JSON 응답 (필요 시)
    scores = Score.objects.all().order_by('total_time')[:10]
    score_list = []
    for s in scores:
        score_list.append({
            "score": s.total_time,
            "created_at": s.created_at.isoformat(),
            "session_id": s.session.session_id,
        })
    return JsonResponse({"scores": score_list})
