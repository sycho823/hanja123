# 한자별곡

한자의 힘으로 검은 안개를 걷고 왕국을 복구하는 초등학생용 한자 8급 학습 웹사이트입니다.

## 포함된 기능

- 학생·선생님 역할 분리
- 학생 학급 코드, 로그인 및 계정 생성 흐름
- 교사 로그인, 학급 생성 및 학생 현황 화면
- 8급 50자와 8개 단원 데이터
- 왕국 지도, 급수 선택, 한자 도감, 복습, 나의 기록
- 그림 속 한자 찾기, 모양 변화, Canvas 따라 쓰기, 퀴즈, 완료 연출
- Firebase 미연결 상태에서도 전체 UI를 확인할 수 있는 체험 모드
- Firestore 보안 규칙과 Firebase 환경변수 예시

## 로컬 실행

Node.js 22.13 이상에서 다음 명령을 실행합니다.

```bash
npm install
npm run dev
```

## Firebase 연결

1. Firebase 프로젝트를 만들고 Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
2. Cloud Firestore를 생성합니다.
3. `.env.example`을 `.env.local`로 복사한 뒤 웹 앱 설정값을 입력합니다.
4. `firestore.rules`를 Firebase 콘솔 또는 Firebase CLI로 배포합니다.

학생의 모험 아이디 계정은 이메일을 직접 받지 않는 대신, 운영 환경에서 신뢰할 수 있는 서버 함수가
가상 이메일 또는 Custom Token을 생성하도록 연결해야 합니다. 학생 비밀번호는 Firebase Authentication만
처리하며 Firestore에는 저장하지 않습니다. 같은 학급의 출석번호와 모험 아이디 중복 검사는 서버 트랜잭션과
보안 규칙을 함께 사용해 확정해야 합니다.

## 주요 데이터 위치

- `data/hanja.ts`: 8급 한자·단원·퀴즈 데이터
- `lib/firebase.ts`: Firebase 초기화
- `app/KingdomApp.tsx`: 화면과 체험 모드 흐름
- `firestore.rules`: 교사·학생 데이터 접근 규칙

7급과 6급은 `data/hanja.ts`와 동일한 구조의 데이터 파일을 추가해 확장할 수 있습니다.
