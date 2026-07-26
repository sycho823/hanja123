# 한자별곡

초등 한자 8급 50자를 직접 써서 안개 왕국을 복구하는 2D 픽셀 RPG형 학습 웹앱입니다.

## 현재 학습 흐름

- 그림 속 한자 찾기와 사물→한자 변형 학습은 제거했습니다.
- 8개 장, 50자 전체를 받아쓰기로 학습합니다.
- 실제 획 데이터와 입력 궤적을 비교해 획 수·순서·방향·전체 형태를 판정합니다.
- 한 장의 모든 글자를 통과해야 다음 왕국이 열립니다.
- 저장되지 않은 예시 학생이나 성적은 표시하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

Firebase를 연결하지 않으면 저장되지 않는 체험 모드로 실행됩니다.

## Firebase / Vercel

1. Firebase Authentication에서 이메일/비밀번호 공급자를 켭니다.
2. Firestore 데이터베이스를 만들고 `firestore.rules`를 배포합니다.
3. `.env.example`의 값들을 로컬 `.env.local`과 Vercel Project Settings → Environment Variables에 넣습니다.
4. GitHub 저장소를 Vercel에 연결해 배포합니다.

`FIREBASE_ADMIN_PRIVATE_KEY`, 서비스 계정 JSON, 학생 비밀번호는 절대로 GitHub에 올리지 마세요.
`.env*`, 서비스 계정 파일, PEM/KEY 파일은 `.gitignore`에 포함되어 있습니다. Firebase의
`NEXT_PUBLIC_*` 웹 설정값은 브라우저용 식별자이지만 환경별 관리를 위해 Vercel 변수로
두는 편이 좋습니다.

## 현재 계정 범위

학생은 Firebase 익명 인증을 사용하며 이메일이나 비밀번호를 수집하지 않습니다. 익명 UID는
브라우저에 유지되어 새로고침 뒤에도 같은 기록을 불러옵니다. 교사는 Google 로그인 후
`ALLOWED_TEACHER_EMAILS` 허용목록과 서버 검증을 모두 통과해야 합니다. 학급 코드는 학급을
찾는 값일 뿐 권한 수단이 아니며, 모든 데이터 접근은 Firebase UID와 교사 custom claim으로
판정합니다.

서버 전용 Firebase Admin 값과 `ALLOWED_TEACHER_EMAILS`는 Vercel 환경 변수로만 관리합니다.
Firestore 규칙 검증은 Java가 설치된 환경에서 `npm run test:rules`로 실행합니다.

## 필기 판정 주의

현재 판정은 태블릿/마우스 궤적과 표준 획 중심선을 기하학적으로 비교하는 교육용 보조
판정입니다. 사람의 필체를 완벽히 이해하는 AI 판정은 아니므로, 실제 교사 평가를 대체하는
용도로 사용하면 안 됩니다.
