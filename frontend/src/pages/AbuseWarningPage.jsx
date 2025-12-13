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
    // 알람 추가 페이지로 이동
    navigate('/add-alarm');
  };

  return (
    <div className="abuse-warning-page-container">
      {/* Quick_Navigation - 상단 네비게이션 바 */}
      <div className="quick-navigation">
        {/* Left Container */}
        <div className="nav-left-container">
          {/* Back Button */}
          <button
            className="nav-back-button"
            onClick={() => navigate(-1)}
            aria-label="뒤로가기"
          >
            <Asset.Icon
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
              name="icon-arrow-back-ios-mono"
              color={adaptive.grey900}
              aria-hidden={true}
              ratio="1/1"
            />
          </button>
          {/* Title Area */}
          <div className="nav-title-area">
            <div className="nav-title-content">
              <Asset.Image
                frameShape={Asset.frameShape.CleanW16}
                backgroundColor="transparent"
                src="https://static.toss.im/appsintoss/9737/f6aa6697-d258-40c2-a59f-91f8e8bab8be.png"
                aria-hidden={true}
                style={{ aspectRatio: '1/1' }}
              />
              <Text color={adaptive.grey900} typography="t6" fontWeight="semibold">
                좋아하면 울리는
              </Text>
            </div>
          </div>
        </div>
        {/* Right Container */}
        <div className="nav-right-container">
          {/* Fixed Icon Area */}
          <div className="nav-fixed-icon-area">
            <button className="nav-icon-button" aria-label="더보기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-dots-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
            <div className="nav-divider"></div>
            <button className="nav-icon-button" aria-label="닫기">
              <Asset.Icon
                frameShape={Asset.frameShape.CleanW20}
                backgroundColor="transparent"
                name="icon-x-mono"
                color={adaptive.greyOpacity600}
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="abuse-warning-content">
        <Spacing size={176} />
        
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
          다른 사람을 사칭하는 등 적절하지 않게 사용하면 알람이 삭제되거나 쓸 수 없어요
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

