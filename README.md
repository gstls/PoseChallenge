# Pose Challenge Project

## 1. 프로젝트 개요
**Pose Challenge**는 사용자가 카메라 앞에서 특정 요가 자세를 **5초 동안 유지**하면 성공으로 판정하고, 유지 시간을 기록하여 순위를 매기는 **웹 애플리케이션**입니다. MediaPipe의 **Pose** 모듈을 사용하여 실시간으로 자세 정보를 수집하고, **Keras MLP 모델**로 자세를 판별합니다. WebSocket으로 클라이언트와 서버가 실시간으로 소통하며, 자세를 일정 시간(페이지 로드 시점부터 세트 종료 시점까지)을 유지했을 때 **점수**를 DB에 기록합니다. 본 프로젝트에서는 **세트 수를 1회**로 설정했으며, 제공되는 자세는 총 **4가지**입니다: **tree**, **dog**, **warrior**, **chair**.

*자세 분류 아이디어 및 코드 구조와 관련하여 [CustomPose-Classification-Mediapipe](https://github.com/naseemap47/CustomPose-Classification-Mediapipe) 리포지토리를 참조하였으며, 가상환경과 스켈레톤 3D 시각화 코드는 이전 프로젝트인 [WebPose3D-RealTime](https://github.com/gstls/WebPose3D-RealTime)를 참고하시길 바랍니다.*

## 2. 데모 영상
- [데모 영상 링크](https://example.com/demo)  
  (데모 영상을 YouTube 등의 링크로 연결하거나, GIF 이미지를 삽입할 수도 있습니다.)

## 3. 주요 기능
- **실시간 자세 인식**: MediaPipe Pose를 통해 클라이언트 측에서 관절 좌표(landmarks)를 추출하고, WebSocket으로 서버에 전송  
- **자세 판별**: Keras **MLPModel**이 전처리된 좌표를 입력받아 각 자세 확률(softmax)을 추론  
- **5초 이상 유지 시 성공**: PoseConsumer에서 5초 이상 목표 자세를 유지하면 `effect: "success"` 메시지를 클라이언트로 전송  
- **점수 기록 및 순위 표시**: 성공 시 걸린 시간을 `/submit_score/` 경로로 전송하여 DB에 저장하고, **score.html**에서 상위 10개 랭킹을 출력  
- **A-Frame 시각화**: 인식된 자세를 3D 스켈레톤과 텍스트로 렌더링  

## 4. 기술 스택
- **프론트엔드**  
  - **HTML / CSS**  
  - **JavaScript** (A-Frame, MediaPipe Pose, WebSocket)
- **백엔드**  
  - **Python (Django)**  
  - **Django Channels** (WebSocket)  
  - **Redis** (캐시/세션 관리)  
- **머신러닝**  
  - **TensorFlow / Keras** (MLP 모델)  
  - **scikit-learn** (LabelEncoder)
- **데이터베이스**  
  - **MySQL**


## 5. 프로젝트 구조
```
<PROJECT_ROOT>/
├─ dnn/
│   ├─ model_loader.py
│   ├─ poseLandmark_csv.py       # 특징 추출 
│   ├─ poseModel.py              # 모델 학습 
│   └─ model/
│       ├─ label_encoder.pkl
│       └─ pose_model.h5
├─ motiontrack/
│   ├─ admin.py
│   ├─ apps.py
│   ├─ consumers.py              # WebSocket 관련 로직
│   ├─ models.py                 # Session, Score 모델
│   ├─ routing.py                # Channels routing
│   ├─ tests.py
│   ├─ urls.py                   # URL 패턴 정의
│   ├─ views.py                  # submit_score 등 Django view
│   └─ __init__.py
├─ static/
│   ├─ css/
│   │      home.css
│   │      score.css
│   ├─ img/
│   │      chair.jpg
│   │      cobra.jpg
│   │      dog.jpg
│   │      tree.jpg
│   │      warrior.jpg
│   └─ js/
│       ├─ home/
│       │     home.js
│       └─ posemodule/            # 클라이언트 가상환경 구체 렌더링 
│              constants.js
│              effect.js
│              kalmanfilter.js
│              main.js
│              mathutils.js
│              posehandler.js
│              skeletonmapping.js
│              socket.js
│              uicontrols.js
├─ templates/                     # 홈, 메인, 스코어 뷰
│       home.html
│       pose.html
│       score.html
├─ WS/
│   ├─ asgi.py
│   ├─ settings.py
│   ├─ urls.py
│   ├─ wsgi.py
│   └─ __init__.py
└─ manage.py
```


## 6. UML 다이어그램

### 6.1 시퀀스 다이어그램
아래는 사용자(클라이언트)와 서버(Consumer)가 실시간으로 통신하며 자세를 인식하고, 5초 유지 시 점수 기록이 진행되는 흐름을 나타냅니다:

![Image](https://github.com/user-attachments/assets/c759bf86-53c7-4721-af4a-e0658b077ef5)

1. **클라이언트(WebSocket)**: 좌표(coords) 전송  
2. **서버(PoseConsumer)**: Keras MLP 모델을 사용하여 추론 후, 5초 유지 시 `effect: "success"` 메시지를 클라이언트로 전송  
3. **클라이언트**: 성공 신호를 수신하고 `/submit_score/` 뷰로 fetch(POST)하여 DB(Score)에 점수를 기록  
4. **서버**: 기록 후 **score.html** 페이지로 리다이렉트

### 6.2 클래스 다이어그램
다음은 프로젝트 주요 클래스(모델, Consumer, WebSocket 등) 간 관계를 보여주는 다이어그램입니다:

![Image](https://github.com/user-attachments/assets/7a95c251-f4d2-447a-a442-c564cb9c1ada)

- **ClientWebSocket** ↔ **PoseConsumer**: WebSocket을 통한 실시간 데이터 교환
- **PoseConsumer** → **RedisCache**: 채널별 상태(목표 자세, 시작 시점 등) 저장
- **PoseConsumer** → **MLPModel, LabelEncoder**: 자세 추론
- **SubmitScoreView** → **Score**: DB에 최종 점수 저장  
  **Score** ↔ **Session** 관계
