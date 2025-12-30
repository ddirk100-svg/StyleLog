# 날씨 API 설정 가이드

## OpenWeatherMap API 사용하기

### 1️⃣ 계정 생성 및 API 키 발급

1. **회원가입**
   - https://openweathermap.org/api 접속
   - "Sign Up" 클릭
   - 이메일, 비밀번호 입력하여 가입

2. **API 키 확인**
   - 로그인 후 우측 상단 계정명 클릭
   - "My API keys" 선택
   - 기본 API 키가 자동 생성되어 있음
   - 또는 "Create key"로 새 키 생성

3. **API 키 활성화**
   - 새로 만든 API 키는 활성화까지 최대 2시간 소요
   - 기존 키는 즉시 사용 가능

### 2️⃣ API 키 설정

`scripts/config.js` 파일에서 API 키를 입력하세요:

```javascript
const WEATHER_API_KEY = 'YOUR_API_KEY_HERE'; // 여기에 발급받은 API 키 입력
```

### 3️⃣ 무료 플랜 제한사항

- **호출 횟수**: 하루 1,000번
- **호출 간격**: 분당 60번
- **데이터 업데이트**: 2시간마다

> 💡 1,000번이면 충분합니다!
> - 페이지 로드 시 1번 호출
> - 하루에 100명이 10번씩 접속해도 문제없음

### 4️⃣ API 사용 예시

#### 현재 위치의 날씨 가져오기
```javascript
const weather = await getCurrentWeather();
console.log(weather);
// {
//   weather: 'sunny',
//   temp: 25.5,
//   description: '맑음',
//   humidity: 60,
//   windSpeed: 3.5
// }
```

#### 특정 도시의 날씨 가져오기
```javascript
const weather = await getWeatherByCity('Seoul');
console.log(weather);
```

#### 좌표로 날씨 가져오기
```javascript
const weather = await getWeatherByCoords(37.5665, 126.9780); // 서울
console.log(weather);
```

### 5️⃣ 날씨 코드 매핑

OpenWeatherMap의 날씨 코드가 자동으로 스타일로그 형식으로 변환됩니다:

| OpenWeather 코드 | 스타일로그 | 아이콘 |
|-----------------|----------|--------|
| 01d, 01n | sunny/clear | ☀️ |
| 02d~04d | cloudy | ☁️ |
| 09d, 10d | rainy | 🌧️ |
| 11d | lightning | ⚡ |
| 13d | snowy | ❄️ |

### 6️⃣ 대체 API (선택사항)

OpenWeatherMap 대신 사용 가능한 무료 날씨 API:

#### 기상청 공공데이터 (한국 전용)
- **장점**: 한국 기상청 공식 데이터, 무료
- **단점**: 복잡한 인증, 좌표 변환 필요
- **링크**: https://www.data.go.kr/

#### WeatherAPI.com
- **무료**: 하루 1백만번 호출
- **링크**: https://www.weatherapi.com/

#### 설정 방법
```javascript
// config.js에서 날씨 API URL만 변경
const WEATHER_API_URL = 'https://api.weatherapi.com/v1/current.json';
```

### 7️⃣ 에러 처리

날씨 API 호출 실패 시:
- 기본값으로 'cloudy' (흐림) 사용
- 사용자에게 에러 알림 없이 조용히 처리
- 콘솔에 에러 로그 출력

```javascript
try {
    const weather = await getCurrentWeather();
} catch (error) {
    console.error('날씨 API 오류:', error);
    // 기본값 사용
    const weather = { weather: 'cloudy', temp: null };
}
```

### 8️⃣ 테스트

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭에서 실행:

```javascript
// 날씨 가져오기 테스트
getCurrentWeather().then(weather => {
    console.log('날씨 정보:', weather);
});

// 서울 날씨 테스트
getWeatherByCity('Seoul').then(weather => {
    console.log('서울 날씨:', weather);
});
```

성공하면 날씨 정보 객체가 출력됩니다!

---

## ⚠️ 문제 해결

### API 키가 작동하지 않을 때
1. API 키가 활성화될 때까지 2시간 대기
2. API 키를 올바르게 복사했는지 확인
3. 무료 플랜 제한(1,000번/일)을 초과하지 않았는지 확인

### CORS 에러가 발생할 때
- OpenWeatherMap은 CORS를 지원하므로 문제없음
- 로컬에서 테스트 시 `file://` 프로토콜 대신 로컬 서버 사용

### 위치 권한이 거부될 때
- 기본값으로 서울 날씨를 가져옴
- 브라우저 설정에서 위치 권한 허용 필요

---

**준비 완료!** 🎉

API 키만 설정하면 실시간 날씨 정보가 자동으로 기록됩니다!



