# 설정 가이드

## 아이콘 이미지 설정 방법

### 1. 이미지 준비

앱 아이콘으로 사용할 이미지를 준비합니다:
- **권장 형식**: PNG (투명 배경)
- **권장 크기**: 512x512px 이상
- **비율**: 1:1 (정사각형)

### 2. 이미지 호스팅

#### 방법 A: 토스 앱인토스 콘솔 사용 (권장)

1. [토스 앱인토스 콘솔](https://developers-apps-in-toss.toss.im/)에 로그인합니다.
2. 앱 설정 페이지로 이동합니다.
3. 아이콘 이미지를 업로드합니다.
4. 업로드된 이미지의 URL을 복사합니다.
5. `granite.config.ts` 파일의 `icon` 필드에 URL을 입력합니다.

#### 방법 B: 외부 이미지 호스팅 서비스 사용

다음과 같은 서비스를 사용할 수 있습니다:

**GitHub 사용 예시:**
1. GitHub 저장소에 이미지 파일을 업로드합니다.
2. Raw 파일 URL을 복사합니다 (예: `https://raw.githubusercontent.com/username/repo/main/icon.png`)
3. `granite.config.ts`의 `icon` 필드에 URL을 입력합니다.

**Imgur 사용 예시:**
1. [Imgur](https://imgur.com/)에 이미지를 업로드합니다.
2. 이미지 URL을 복사합니다 (예: `https://i.imgur.com/xxxxx.png`)
3. `granite.config.ts`의 `icon` 필드에 URL을 입력합니다.

**Cloudinary 사용 예시:**
1. [Cloudinary](https://cloudinary.com/)에 계정을 생성하고 이미지를 업로드합니다.
2. 이미지 URL을 복사합니다.
3. `granite.config.ts`의 `icon` 필드에 URL을 입력합니다.

#### 방법 C: 로컬 개발 서버 사용 (개발용만)

1. `public` 폴더에 `icon.png` 파일을 저장합니다.
2. 개발 서버를 실행합니다 (`npm run dev`).
3. `granite.config.ts`의 `icon` 필드에 다음을 입력합니다:
   ```typescript
   icon: 'http://localhost:5173/icon.png'
   ```
   ⚠️ **주의**: 이 방법은 개발 환경에서만 사용 가능하며, 프로덕션에서는 작동하지 않습니다.

### 3. granite.config.ts 파일 수정

`granite.config.ts` 파일을 열고 `icon` 필드를 수정합니다:

```typescript
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'love-alarm',
  brand: {
    displayName: '좋아하면 울리는',
    primaryColor: '#FF6B6B',
    icon: 'https://your-image-url.com/icon.png', // 여기에 이미지 URL 입력
    bridgeColorMode: 'basic',
  },
  // ... 나머지 설정
});
```

### 4. 변경사항 확인

설정을 변경한 후:
1. 개발 서버를 재시작합니다 (`npm run dev`).
2. 토스 앱에서 앱을 다시 로드합니다.
3. 앱 아이콘이 변경되었는지 확인합니다.

## 결제 상품 ID 설정 방법

### 1. 토스 앱인토스 콘솔에서 상품 등록

1. [토스 앱인토스 콘솔](https://developers-apps-in-toss.toss.im/)에 로그인합니다.
2. 인앱 결제 메뉴로 이동합니다.
3. 새 상품을 등록합니다:
   - 상품명: "알람 슬롯 추가"
   - 가격: 1,000원
   - 상품 ID: `alarm_slot_1000` (또는 원하는 ID)
   - 설명: "알람 슬롯을 하나 더 추가합니다"

### 2. PaymentModal.jsx 파일 수정

`src/components/PaymentModal.jsx` 파일을 열고 상품 ID를 수정합니다:

```javascript
const handlePurchase = async () => {
  setIsProcessing(true);
  try {
    if (typeof window !== 'undefined' && window.appsInToss?.IAP) {
      await window.appsInToss.IAP.createOneTimePurchaseOrder({
        productId: 'alarm_slot_1000', // 콘솔에 등록한 실제 상품 ID로 변경
      });
      onSuccess();
    } else {
      // 개발 환경 시뮬레이션
      console.log('결제 시뮬레이션 (개발 환경)');
      setTimeout(() => {
        onSuccess();
      }, 500);
    }
  } catch (error) {
    console.error('결제 실패:', error);
    alert('결제에 실패했습니다. 다시 시도해주세요.');
  } finally {
    setIsProcessing(false);
  }
};
```

### 3. 테스트

1. 개발 서버를 재시작합니다.
2. 알람 추가 페이지에서 두 번째 알람을 추가하려고 시도합니다.
3. 결제 팝업이 표시되는지 확인합니다.
4. 결제 버튼을 클릭하여 결제 프로세스를 테스트합니다.

## 환경 변수 설정 (필요시)

향후 서버 연동이 필요한 경우, 환경 변수를 설정할 수 있습니다:

1. `.env` 파일을 생성합니다:
   ```
   VITE_API_BASE_URL=https://api.example.com
   ```

2. 코드에서 사용:
   ```javascript
   const apiUrl = import.meta.env.VITE_API_BASE_URL;
   ```

## 추가 설정

### 앱 이름 변경

`granite.config.ts`에서 `displayName`을 변경합니다:

```typescript
brand: {
  displayName: '원하는 앱 이름',
  // ...
}
```

### 기본 색상 변경

`granite.config.ts`에서 `primaryColor`를 변경합니다:

```typescript
brand: {
  primaryColor: '#원하는색상코드',
  // ...
}
```

---

설정이 완료되면 `npm run dev`로 개발 서버를 실행하여 변경사항을 확인하세요.




