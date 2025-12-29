import { useState } from 'react';
import {
  Text,
  Top,
  Button,
  Spacing,
  Select,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import './FeedbackPage.css';

// 피드백 카테고리 옵션
const CATEGORY_OPTIONS = [
  { value: '', label: '선택해주세요' },
  { value: 'suggestion', label: '건의' },
  { value: 'bug', label: '버그 제보' },
  { value: 'report', label: '신고' },
  { value: 'praise', label: '칭찬' },
  { value: 'other', label: '기타' },
];

const MAX_CONTENT_LENGTH = 500;

export function FeedbackPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState({ show: false, message: '' });

  const showErrorToast = (message) => {
    setErrorToast({ show: true, message });
    setTimeout(() => {
      setErrorToast({ show: false, message: '' });
    }, 3000);
  };

  const isValid = category && content.trim().length >= 10;

  const handleSubmit = async () => {
    if (!isValid) {
      showErrorToast('카테고리와 내용을 입력해주세요. (최소 10자)');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submitFeedback({
        category,
        content: content.trim(),
      });
      
      // 성공 시 설정 페이지로 이동 + 토스트 표시
      navigate('/settings', { state: { showFeedbackToast: true } });
    } catch (error) {
      console.error('피드백 제출 실패:', error);
      showErrorToast(error.message || '피드백 전송에 실패했어요. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContentChange = (e) => {
    const value = e.target.value;
    if (value.length <= MAX_CONTENT_LENGTH) {
      setContent(value);
    }
  };

  return (
    <div className="feedback-page-container">
      <Spacing size={14} />

      <div className="feedback-top-section">
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
            <div className="feedback-subtitle">
              <Text 
                color={adaptive.grey700} 
                typography="t7"
                style={{ 
                  fontSize: '17px', 
                  fontWeight: 500,
                  color: adaptive.grey700,
                  lineHeight: '1.5',
                }}
              >
                서비스 개선에 도움이 되는 의견을 보내주세요.
                <br />
                답변은 바로 드리지 못하지만 꼭 읽어볼게요.
              </Text>
            </div>
          }
        />
      </div>

      <Spacing size={24} />

      <div className="feedback-content">
        {/* 카테고리 선택 */}
        <div className="feedback-field">
          <label className="feedback-label">의견 종류</label>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="feedback-select"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <Spacing size={24} />

        {/* 내용 입력 */}
        <div className="feedback-field">
          <label className="feedback-label">내용</label>
          <textarea
            className="feedback-textarea"
            value={content}
            onChange={handleContentChange}
            placeholder="어떤 점이 불편하셨나요?&#10;또는 개선점을 자유롭게 작성해주세요."
            rows={8}
          />
          <div className="feedback-char-count">
            <Text color={adaptive.grey500} typography="t7">
              {content.length}/{MAX_CONTENT_LENGTH}
            </Text>
          </div>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="feedback-button-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          loading={isSubmitting}
        >
          보내기
        </Button>
      </div>

      {/* 에러 Toast */}
      <div className={`single-toast error ${errorToast.show ? 'show' : ''}`}>
        <div className="custom-toast-content">
          <span className="custom-toast-error-icon">!</span>
          <span className="custom-toast-text">{errorToast.message}</span>
        </div>
      </div>
    </div>
  );
}

