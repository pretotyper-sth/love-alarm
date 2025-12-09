# 인트로 페이지 다시 보기

인트로 페이지를 다시 보려면 다음 방법 중 하나를 사용하세요:

## 방법 1: 브라우저 개발자 도구 사용 (권장)

1. 브라우저에서 **F12** 또는 **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows)를 눌러 개발자 도구를 엽니다.
2. **Application** 탭 (Chrome) 또는 **Storage** 탭 (Firefox)을 클릭합니다.
3. 왼쪽 메뉴에서 **Local Storage** > **http://localhost:5173** (또는 현재 URL)을 선택합니다.
4. `has_visited_intro` 키를 찾아서 삭제합니다.
5. 페이지를 새로고침합니다.

## 방법 2: 브라우저 콘솔 사용

1. 브라우저 개발자 도구를 엽니다 (F12).
2. **Console** 탭을 클릭합니다.
3. 다음 명령어를 입력하고 Enter를 누릅니다:

```javascript
localStorage.removeItem('has_visited_intro')
location.reload()
```

## 방법 3: 시크릿/프라이빗 모드 사용

시크릿/프라이빗 모드로 브라우저를 열면 localStorage가 비어있으므로 인트로 페이지를 볼 수 있습니다.

## 방법 4: 모든 localStorage 삭제

개발 중이라면 모든 localStorage를 삭제할 수도 있습니다:

```javascript
localStorage.clear()
location.reload()
```

---

**참고**: 프로덕션 환경에서는 사용자가 인트로 페이지를 다시 볼 수 있도록 설정에서 초기화 옵션을 제공하는 것이 좋습니다.




