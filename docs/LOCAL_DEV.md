# 로컬에서 확인하는 방법

## 대부분의 경우 (추천)

**로컬 `npm` 없이** 아래만 쓰면 됩니다.

| 환경 | 주소 |
|------|------|
| Alpha (배포 후 확인) | https://alpha.stylelog.co.kr |
| 리얼 | https://www.stylelog.co.kr |

GitHub에 푸시하면 Vercel이 자동 배포합니다. **AI 대화**는 서버 API가 필요하므로 Alpha·리얼에서 테스트하는 것이 가장 간단합니다.

## 로컬에서 AI API까지 쓰고 싶을 때만

1. [Node.js](https://nodejs.org/) LTS 설치
2. 프로젝트 폴더에서 한 번: `npm install`
3. `.env.local`에 `OPENAI_API_KEY` 등 (이미 있으면 생략)
4. `npm run dev` 실행
5. 브라우저: `http://localhost:3000/home.html`

`npm run dev`는 **관리자 API + AI 채팅 API**를 같이 띄웁니다. Live Server만 켠 경우에는 HTML은 보이지만 **AI는 동작하지 않습니다.**
