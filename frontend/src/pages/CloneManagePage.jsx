import { useState, useEffect } from 'react';
import {
  Text,
  Top,
  Button,
  Spacing,
  TextField,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { logScreen, logClick } from '../utils/analytics';
import { CLONE_COPY } from '../constants/cloneCopy';
import './CloneManagePage.css';

const IG_VERIFIED_KEY = 'love_alarm_instagram_verified_username';

export function CloneManagePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clone, setClone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // 생성 폼
  const [gender, setGender] = useState('');
  const [interestedIn, setInterestedIn] = useState('');
  const [allowMatching, setAllowMatching] = useState(false);

  const verifiedUsername = localStorage.getItem(IG_VERIFIED_KEY) || '';
  const isVerified = !!verifiedUsername;
  const copy = CLONE_COPY.cloneManagement;

  useEffect(() => {
    logScreen('clone_manage_screen');
    loadClone();
  }, []);

  const loadClone = async () => {
    try {
      const data = await api.getClone();
      setClone(data.clone);
    } catch {
      // 클론 없음
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!isVerified) {
      setError('인스타그램 인증이 필요해요. 더보기 > 인스타그램 인증에서 먼저 인증해 주세요.');
      return;
    }

    if (!gender) {
      setError('성별을 선택해 주세요.');
      return;
    }

    setCreating(true);
    setError(null);
    logClick('clone_create_start');

    try {
      const data = await api.createClone(verifiedUsername, {
        gender,
        interestedIn: interestedIn || 'all',
        allowMatching,
      });

      logClick('clone_create_success');
      setClone(data.clone);
    } catch (err) {
      setError(err.message);
      logClick('clone_create_fail', { reason: err.message });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleMatching = async () => {
    try {
      const data = await api.updateClone({ allowMatching: !clone.allowMatching });
      setClone(data.clone);
      logClick('clone_toggle_matching', { enabled: !clone.allowMatching });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = clone.status === 'active' ? 'paused' : 'active';
    try {
      const data = await api.updateClone({ status: newStatus });
      setClone(data.clone);
      logClick('clone_toggle_status', { status: newStatus });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(copy.deleteConfirm)) return;

    try {
      await api.deleteClone();
      logClick('clone_delete');
      setClone(null);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="clone-manage-page">
        <div className="clone-manage-loading">
          <Text color={adaptive.grey500} typography="t7">불러오는 중...</Text>
        </div>
      </div>
    );
  }

  // 클론이 없으면 생성 UI
  if (!clone) {
    return (
      <div className="clone-manage-page">
        <Top
          title={
            <Top.TitleParagraph size={22} color={adaptive.grey900} fontWeight="bold">
              {copy.createTitle}
            </Top.TitleParagraph>
          }
          left={<Top.BackButton onClick={() => navigate(-1)} />}
          subtitleBottom={
            <Text color={adaptive.grey600} typography="t7" style={{ whiteSpace: 'pre-line' }}>
              {copy.createDescription}
            </Text>
          }
        />

        <Spacing size={24} />

        <div className="clone-manage-content">
          {!isVerified && (
            <div className="clone-manage-warning">
              <Text typography="t7" color="#FF6B6B">
                인스타그램 인증이 필요해요
              </Text>
              <Spacing size={8} />
              <Button
                size="medium"
                variant="weak"
                onClick={() => navigate('/more')}
              >
                인증하러 가기
              </Button>
            </div>
          )}

          {isVerified && (
            <>
              <TextField
                variant="big"
                label="인스타그램 ID"
                labelOption="sustain"
                value={verifiedUsername}
                disabled
                onChange={() => {}}
                help="인증된 계정이 자동으로 적용돼요."
              />

              <Spacing size={16} />

              <div className="clone-manage-field">
                <Text typography="t7" fontWeight="bold" color={adaptive.grey800}>
                  {copy.genderLabel}
                </Text>
                <Spacing size={8} />
                <div className="clone-manage-options">
                  {copy.genderOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`clone-manage-option ${gender === opt.value ? 'selected' : ''}`}
                      onClick={() => setGender(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Spacing size={16} />

              <div className="clone-manage-field">
                <Text typography="t7" fontWeight="bold" color={adaptive.grey800}>
                  {copy.interestedInLabel}
                </Text>
                <Spacing size={8} />
                <div className="clone-manage-options">
                  {copy.interestedInOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`clone-manage-option ${interestedIn === opt.value ? 'selected' : ''}`}
                      onClick={() => setInterestedIn(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <Spacing size={16} />

              <div className="clone-manage-field">
                <div className="clone-manage-toggle-row">
                  <div>
                    <Text typography="t7" fontWeight="bold" color={adaptive.grey800}>
                      {copy.allowMatchingLabel}
                    </Text>
                    <Spacing size={4} />
                    <Text typography="t8" color={adaptive.grey500} style={{ whiteSpace: 'pre-line' }}>
                      {copy.allowMatchingDescription}
                    </Text>
                  </div>
                  <label className="clone-manage-switch">
                    <input
                      type="checkbox"
                      checked={allowMatching}
                      onChange={(e) => setAllowMatching(e.target.checked)}
                    />
                    <span className="clone-manage-slider" />
                  </label>
                </div>
              </div>

              {error && (
                <>
                  <Spacing size={12} />
                  <Text typography="t8" color="#FF4444">{error}</Text>
                </>
              )}

              <Spacing size={32} />

              <Button
                size="xlarge"
                display="block"
                onClick={handleCreate}
                loading={creating}
                disabled={creating || !gender}
              >
                {CLONE_COPY.intro.cta}
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  // 클론이 있으면 관리 UI
  return (
    <div className="clone-manage-page">
      <Top
        title={
          <Top.TitleParagraph size={22} color={adaptive.grey900} fontWeight="bold">
            AI 클론 관리
          </Top.TitleParagraph>
        }
        left={<Top.BackButton onClick={() => navigate(-1)} />}
      />

      <Spacing size={16} />

      <div className="clone-manage-content">
        <div className="clone-manage-status-card">
          <div className="clone-manage-status-header">
            <Text typography="t6" fontWeight="bold" color={adaptive.grey900}>
              @{clone.instagramId}
            </Text>
            <span className={`clone-manage-badge ${clone.status}`}>
              {clone.status === 'active' ? copy.statusActive : copy.statusPaused}
            </span>
          </div>

          <Spacing size={12} />

          <div className="clone-manage-info-row">
            <Text typography="t8" color={adaptive.grey500}>성별</Text>
            <Text typography="t8" color={adaptive.grey700}>
              {copy.genderOptions.find((o) => o.value === clone.gender)?.label || '미설정'}
            </Text>
          </div>

          <div className="clone-manage-info-row">
            <Text typography="t8" color={adaptive.grey500}>관심 성별</Text>
            <Text typography="t8" color={adaptive.grey700}>
              {copy.interestedInOptions.find((o) => o.value === clone.interestedIn)?.label || '모두'}
            </Text>
          </div>

          <div className="clone-manage-info-row">
            <Text typography="t8" color={adaptive.grey500}>생성일</Text>
            <Text typography="t8" color={adaptive.grey700}>
              {new Date(clone.createdAt).toLocaleDateString('ko-KR')}
            </Text>
          </div>
        </div>

        <Spacing size={20} />

        <div className="clone-manage-field">
          <div className="clone-manage-toggle-row">
            <div>
              <Text typography="t7" fontWeight="bold" color={adaptive.grey800}>
                {copy.allowMatchingLabel}
              </Text>
              <Spacing size={4} />
              <Text typography="t8" color={adaptive.grey500} style={{ whiteSpace: 'pre-line' }}>
                {copy.allowMatchingDescription}
              </Text>
            </div>
            <label className="clone-manage-switch">
              <input
                type="checkbox"
                checked={clone.allowMatching}
                onChange={handleToggleMatching}
              />
              <span className="clone-manage-slider" />
            </label>
          </div>
        </div>

        <Spacing size={16} />

        <div className="clone-manage-field">
          <div className="clone-manage-toggle-row">
            <div>
              <Text typography="t7" fontWeight="bold" color={adaptive.grey800}>
                클론 활성화
              </Text>
              <Spacing size={4} />
              <Text typography="t8" color={adaptive.grey500}>
                비활성화하면 대화 매칭이 일시정지돼요.
              </Text>
            </div>
            <label className="clone-manage-switch">
              <input
                type="checkbox"
                checked={clone.status === 'active'}
                onChange={handleToggleStatus}
              />
              <span className="clone-manage-slider" />
            </label>
          </div>
        </div>

        {error && (
          <>
            <Spacing size={12} />
            <Text typography="t8" color="#FF4444">{error}</Text>
          </>
        )}

        <Spacing size={32} />

        <Button
          size="large"
          display="block"
          onClick={() => navigate('/clone-conversations')}
        >
          AI 대화 기록 보기
        </Button>

        <Spacing size={12} />

        <button className="clone-manage-delete-btn" onClick={handleDelete}>
          <Text typography="t8" color="#FF4444">클론 삭제하기</Text>
        </button>
      </div>
    </div>
  );
}
