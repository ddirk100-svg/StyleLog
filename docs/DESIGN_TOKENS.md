# 디자인 토큰 (Design Tokens)

모든 색상, 간격, 폰트 크기 등의 디자인 값은 `styles/variables.css`에서 CSS 변수로 중앙 관리됩니다.

## 사용 방법

모든 CSS 파일에서 `@import url('variables.css');`를 최상단에 추가하여 변수를 사용할 수 있습니다.

```css
@import url('variables.css');

.my-class {
    color: var(--color-text-primary);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
}
```

## 주요 변수 카테고리

### 색상 (Colors)

#### Primary Colors
- `--color-primary`: #667eea (주요 색상)
- `--color-primary-dark`: #764ba2 (어두운 버전)
- `--color-primary-light`: #f8f9ff (밝은 버전)

#### Accent Colors
- `--color-accent`: #67d5f5 (강조 색상)
- `--color-accent-dark`: #4fc3f0
- `--color-accent-light`: #E3F2FD

#### Favorite/Heart Color
- `--color-favorite`: #ff6b6b (즐겨찾기/하트 색상)
- `--color-favorite-light`: rgba(255, 107, 107, 0.15)

#### Text Colors
- `--color-text-primary`: #333 (주요 텍스트)
- `--color-text-secondary`: #666 (보조 텍스트)
- `--color-text-tertiary`: #999 (3차 텍스트)
- `--color-text-disabled`: #ccc (비활성 텍스트)
- `--color-text-inverse`: #fff (반전 텍스트)

#### Background Colors
- `--color-bg-primary`: #fff (주요 배경)
- `--color-bg-secondary`: #f5f5f5 (보조 배경)
- `--color-bg-tertiary`: #fafafa (3차 배경)
- `--color-bg-hover`: #f8f9ff (호버 배경)

#### Border Colors
- `--color-border-light`: #e0e0e0
- `--color-border-lighter`: #f0f0f0
- `--color-border-focus`: var(--color-accent)

#### Weather Colors
- `--color-weather-sunny-start/end`: 맑은 날씨 그라데이션
- `--color-weather-cloudy-start/end`: 흐린 날씨 그라데이션
- `--color-weather-rainy-start/end`: 비 오는 날씨 그라데이션
- `--color-weather-snowy-start/end`: 눈 오는 날씨 그라데이션
- `--color-weather-lightning-start/end`: 번개 날씨 그라데이션

#### Temperature Colors
- `--color-temp-high`: #ff6b6b (최고 기온)
- `--color-temp-low`: #4a90e2 (최저 기온)

### 간격 (Spacing)

- `--spacing-xs`: 4px
- `--spacing-sm`: 8px
- `--spacing-md`: 12px
- `--spacing-lg`: 16px
- `--spacing-xl`: 20px
- `--spacing-2xl`: 24px
- `--spacing-3xl`: 32px
- `--spacing-4xl`: 40px

### Border Radius

- `--radius-sm`: 8px
- `--radius-md`: 12px
- `--radius-lg`: 16px
- `--radius-xl`: 20px
- `--radius-full`: 50%

### Font Sizes

- `--font-size-xs`: 12px
- `--font-size-sm`: 13px
- `--font-size-base`: 14px
- `--font-size-md`: 15px
- `--font-size-lg`: 16px
- `--font-size-xl`: 18px
- `--font-size-2xl`: 20px
- `--font-size-3xl`: 24px
- `--font-size-4xl`: 32px

### Font Weights

- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

### Transitions

- `--transition-fast`: 0.2s
- `--transition-base`: 0.3s
- `--transition-slow`: 0.5s
- `--transition-ease`: cubic-bezier(0.4, 0, 0.2, 1)

### Z-index

- `--z-index-base`: 1
- `--z-index-dropdown`: 100
- `--z-index-sticky`: 100
- `--z-index-modal`: 1000
- `--z-index-popup`: 9999

## 마이그레이션 가이드

기존 하드코딩된 값들을 변수로 변경하는 작업이 진행 중입니다. 새로운 스타일을 작성할 때는 반드시 변수를 사용하세요.

### Before
```css
.my-button {
    color: #333;
    padding: 16px 20px;
    border-radius: 12px;
    background-color: #67d5f5;
}
```

### After
```css
.my-button {
    color: var(--color-text-primary);
    padding: var(--spacing-lg) var(--spacing-xl);
    border-radius: var(--radius-md);
    background-color: var(--color-accent);
}
```

## 향후 계획

1. 모든 CSS 파일에서 하드코딩된 값 제거
2. 다크 모드 지원을 위한 변수 추가
3. 반응형 브레이크포인트 변수 추가



