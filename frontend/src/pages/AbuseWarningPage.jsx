import { useNavigate } from 'react-router-dom';
import {
  Asset,
  Text,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import './AbuseWarningPage.css';

// 경고 페이지 확인 여부 키
const ABUSE_WARNING_CONFIRMED_KEY = 'love_alarm_abuse_warning_confirmed';

export function AbuseWarningPage() {
  const navigate = useNavigate();

  const handleConfirm = () => {
    // 확인 여부 저장
    localStorage.setItem(ABUSE_WARNING_CONFIRMED_KEY, 'true');
    // 알람 추가 페이지로 이동 (replace: true로 경고 페이지 히스토리 제거)
    navigate('/add-alarm', { replace: true });
  };

  return (
    <div className="abuse-warning-page-container">
      {/* 콘텐츠 영역 */}
      <div className="abuse-warning-content">
        <Spacing size={132} />
        
        {/* 이모지 이미지 */}
        <div className="abuse-warning-image">
          <Asset.Image
            frameShape={{ width: 100 }}
            backgroundColor="transparent"
            src="https://static.toss.im/3d-emojis/u1F645-blue.png"
            aria-hidden={true}
            style={{ width: 100, height: 100 }}
          />
        </div>

        <Spacing size={20} />

        {/* 메인 텍스트 */}
        <Text
          color={adaptive.grey800}
          typography="t4"
          fontWeight="bold"
          textAlign="center"
          style={{ 
            padding: '0 24px',
            lineHeight: 1.4,
          }}
        >
          다른 사람을 사칭하는 등 적절하지 않게 사용 시 알람이 삭제되거나 접속이 제한돼요
        </Text>

        <Spacing size={20} />

        {/* 서브 텍스트 */}
        <Text
          color={adaptive.grey600}
          typography="t5"
          fontWeight="medium"
          textAlign="center"
        >
          건전한 서비스를 위해 모두의 도움이 필요해요.
        </Text>
      </div>

      {/* 하단 버튼 */}
      <div className="abuse-warning-button-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleConfirm}
        >
          확인했어요
        </Button>
      </div>
    </div>
  );
}

// 경고 페이지 확인 여부 체크 함수 (외부에서 사용)
export function hasConfirmedAbuseWarning() {
  return localStorage.getItem(ABUSE_WARNING_CONFIRMED_KEY) === 'true';
}




