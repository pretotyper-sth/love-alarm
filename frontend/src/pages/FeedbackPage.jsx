import { useState } from 'react';
import {
  Text,
  Top,
  TextField,
  TextArea,
  Spacing,
  Button,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './FeedbackPage.css';

// 카테고리 옵션
const CATEGORY_OPTIONS = [
  { name: '건의', value: '건의' },
  { name: '버그', value: '버그' },
  { name: '신고', value: '신고' },
  { name: '칭찬', value: '칭찬' },
  { name: '기타', value: '기타' },
];

export function FeedbackPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryValue, setSelectedCategoryValue] = useState(null);
  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });

  const showErrorToast = (message) => {
    setErrorToast({ show: true, message });
    
    // 3초 후 fade out 시작
    setTimeout(() => {
      setErrorToast((prev) => ({ ...prev, show: false }));
      
      // fade out 애니메이션 후 완전히 제거
      setTimeout(() => {
        setErrorToast({ show: false, message: '' });
      }, 300);
    }, 3000);
  };

  const handleSubmit = async () => {
    // 유효성 검사
    if (!category) {
      showErrorToast('카테고리를 선택해 주세요');
      return;
    }

    if (content.trim().length < 10) {
      showErrorToast('최소 10자 이상 입력해 주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      // API로 피드백 제출
      await api.submitFeedback(category, content.trim());
      
      // 성공 시 설정 페이지로 이동 (replace: true로 히스토리 중복 방지)
      navigate('/settings', { replace: true, state: { showFeedbackSuccess: true } });
    } catch (error) {
      console.error('❌ 피드백 제출 실패:', error);
      showErrorToast(error.message || '의견을 제출하지 못했어요');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feedback-page-container">
      <div className="feedback-form-content">
      <Spacing size={14} />

      <div className="add-alarm-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              fontWeight="bold"
              style={{ fontSize: '22px' }}
            >
              의견 보내기
            </Top.TitleParagraph>
          }
          subtitleBottom={
            <div className="add-alarm-subtitle">
              <Text 
                color={adaptive.grey700} 
                typography="t7"
                style={{ 
                  fontSize: '17px', 
                  fontWeight: 500,
                  color: adaptive.grey700 
                }}
              >
                서비스 개선에 도움이 되는 의견을 보내주세요.
                하나도 놓치지 않고 전부 읽어볼게요!
              </Text>
            </div>
          }
        />
      </div>

      <Spacing size={16} />

      <div className="add-alarm-content">
          <div 
            className={`category-field-wrapper ${showCategorySheet ? 'is-focused' : ''}`}
            onClick={() => {
              setShowCategorySheet(true);
            }}
          >
            <TextField
              variant="line"
              hasError={false}
              label="카테고리"
              labelOption="sustain"
              value={category}
              placeholder="선택"
              readOnly={true}
              right={
                category ? (
                  <img 
                    src="https://static.toss.im/icons/png/4x/icon-arrow-down-mono.png"
                    alt="아래 화살표"
                    style={{ width: '20px', height: '20px', opacity: 0.6 }}
                  />
                ) : null
              }
              style={{ pointerEvents: 'none' }}
            />
          </div>

        <Spacing size={16} />

          {/* 내용 입력 TextArea */}
          <div className="feedback-textarea-wrapper">
            <TextArea
              variant="box"
              minHeight={200}
              label="내용"
              labelOption="sustain"
              placeholder="자유롭게 의견을 작성해 주세요."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
              }}
              maxLength={500}
            />
            <div style={{ 
              marginTop: '-16px', 
              textAlign: 'right',
              paddingRight: '20px'
            }}>
              <Text
                typography="t8"
                style={{ 
                  fontSize: '12px',
                  color: '#8b95a1'
                }}
              >
                {content.length}/500 (최소 10자)
              </Text>
          </div>
        </div>
      </div>
      </div>

      <div className="feedback-submit-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleSubmit}
          disabled={!category || content.trim().length < 10 || isSubmitting}
          loading={isSubmitting}
        >
          보내기
        </Button>
      </div>

      {/* 에러 Toast */}
      {errorToast.message && (
        <div className={`single-toast ${errorToast.show ? 'show' : ''}`}>
          <div className="custom-toast-content">
            <span className="custom-toast-error-icon">!</span>
            <span className="custom-toast-text">{errorToast.message}</span>
          </div>
        </div>
      )}

      {/* 카테고리 선택 BottomSheet */}
      <div className={`feedback-bottom-sheet-overlay ${showCategorySheet ? 'show' : ''}`} onClick={() => setShowCategorySheet(false)}>
        <div className={`feedback-bottom-sheet ${showCategorySheet ? 'show' : ''}`} onClick={(e) => e.stopPropagation()}>
          <div className="feedback-sheet-handle" />
          <div className="bottom-sheet-header">
            <h3 className="bottom-sheet-title">카테고리 선택</h3>
          </div>
          <div className="feedback-sheet-options">
            {CATEGORY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="feedback-sheet-option"
                onClick={() => {
                  setSelectedCategoryValue(option.value);
                  setCategory(option.name);
                  setShowCategorySheet(false);
                }}
              >
                <span className="feedback-sheet-option-label">{option.name}</span>
                {selectedCategoryValue === option.value && (
                  <span className="feedback-sheet-option-check">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


