import { PageHeader } from '../components/PageHeader';
import { useBackDismiss } from '../utils/backNavigation';
import { SheetCloseButton } from '../components/SheetControls';
import { useState } from 'react';
import {
  Text,
  TextField,
  TextArea,
  Spacing,
  BottomCTA,
} from '@toss/tds-mobile';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import './FeedbackPage.css';
import '../components/FormFields.css';

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
  useBackDismiss(showCategorySheet, () => setShowCategorySheet(false));
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
      <PageHeader title="의견 보내기" subtitle="서비스 개선에 도움이 되는 의견을 보내주세요. 하나도 놓치지 않고 전부 읽어볼게요!" />
      <Spacing size={28} />
      <div className="feedback-entry-fields form-entry-fields">
        <div className="form-field-heading"><label htmlFor="feedback-category">카테고리</label></div>
        <TextField.Button
          variant="box"
          paddingTop={8}
          paddingBottom={0}
          id="feedback-category"
          labelOption="sustain"
          value={category}
          placeholder="선택"
          onClick={() => setShowCategorySheet(true)}
          aria-haspopup="dialog"
          aria-expanded={showCategorySheet}
          right={<img src="https://static.toss.im/icons/png/4x/icon-arrow-down-mono.png" alt="" style={{ width: 20, height: 20 }} />}
        />
        <Spacing size={28} />
        <div className="form-field-heading">
          <label htmlFor="feedback-content">내용</label>
          <span>{content.length}/500 (최소 10자)</span>
        </div>
        <TextArea
          id="feedback-content"
          variant="box"
          paddingTop={8}
          paddingBottom={0}
          minHeight={200}
          placeholder="자유롭게 의견을 작성해 주세요."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
        />
      </div>
      </div>
      <BottomCTA
        onClick={handleSubmit}
        disabled={!category || content.trim().length < 10 || isSubmitting}
        loading={isSubmitting}
      >보내기</BottomCTA>

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
            <div className="sheet-title-row"><h3 className="bottom-sheet-title">카테고리 선택</h3><SheetCloseButton onClose={() => setShowCategorySheet(false)} source="feedback_category" label="카테고리 선택 닫기" /></div>
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


