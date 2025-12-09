import { useNavigate } from 'react-router-dom';
import {
  Asset,
  Text,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import './ErrorPage.css';

export function ErrorPage() {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="error-page-container">
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
              color="#191F28"
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
              <Text color="#191F28" typography="t6" fontWeight="semibold">
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
                color="rgba(0, 19, 43, 0.58)"
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
                color="rgba(0, 19, 43, 0.58)"
                aria-hidden={true}
                ratio="1/1"
              />
            </button>
          </div>
        </div>
      </div>

      <Spacing size={30} />

      {/* 에러 콘텐츠 - MatchSuccessPage와 동일한 구조 */}
      <div className="error-content-section">
        <img 
          src="https://static.toss.im/3d-emojis/u1F519-return.png" 
          alt="다시 시도"
          className="error-emoji-image"
        />

        {/* 타이틀 */}
        <h1 className="error-title">잠시 후 다시 시도해주세요</h1>
        
        {/* 서브타이틀 */}
        <p className="error-subtitle">
          일시적인 오류가 발생했어요.
        </p>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="error-fixed-bottom-cta">
        <Button
          size="xlarge"
          color="dark"
          variant="weak"
          display="block"
          onClick={handleClose}
          style={{
            '--button-background-color': '#f2f4f6',
            '--button-color': '#6b7684',
          }}
        >
          닫기
        </Button>
        <Button
          size="xlarge"
          display="block"
          onClick={handleRetry}
        >
          다시 시도하기
        </Button>
      </div>
    </div>
  );
}
