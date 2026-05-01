import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Top,
  Text,
  TextField,
  Spacing,
  Asset,
  Button,
  List,
  ListRow,
  Switch,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import './CloneManagePage.css';
import './OtherCloneSelectPage.css';

function getCachedAlarmTargets() {
  try {
    const cachedAlarms = JSON.parse(localStorage.getItem('love_alarm_cached_list') || '[]');
    const targetIds = cachedAlarms
      .map((alarm) => alarm.targetInstagramId || alarm.targetId)
      .filter(Boolean)
      .map(normalizeInstagramId);

    return [...new Set(targetIds)];
  } catch {
    return [];
  }
}

function normalizeInstagramId(value) {
  return value.trim().replace(/^@/, '').toLowerCase();
}

export function OtherCloneSelectPage() {
  const navigate = useNavigate();
  const [targetInstagramId, setTargetInstagramId] = useState('');
  const [targetGender, setTargetGender] = useState('');
  const [allowCloneConversation, setAllowCloneConversation] = useState(true);
  const [confirmedActiveClone, setConfirmedActiveClone] = useState(false);
  const [alarmTargets] = useState(getCachedAlarmTargets);

  const normalizedTargetId = normalizeInstagramId(targetInstagramId);
  const canPreviewSpecific = Boolean(normalizedTargetId && targetGender && allowCloneConversation && confirmedActiveClone);

  const openAiCloneWithState = (state) => {
    navigate('/ai-clone', {
      replace: true,
      state,
    });
  };

  const handleSpecificPreview = () => {
    if (!canPreviewSpecific) return;

    if (normalizedTargetId.includes('closed') || normalizedTargetId.includes('off')) {
      openAiCloneWithState({
        otherCloneAction: 'unavailable',
      });
      return;
    }

    openAiCloneWithState({
      otherCloneAction: 'specific',
      targetInstagramId: normalizedTargetId,
      targetGender,
    });
  };

  const handleClearTargetId = () => {
    setTargetInstagramId('');
  };

  return (
    <div className="add-alarm-page-container">
      <div className="add-alarm-form-content">
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
              상대 클론 선택
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
                상대를 직접 지정하고 클론끼리의 케미를 확인해요.
              </Text>
            </div>
          }
        />
      </div>

      <Spacing size={10} />

      <div className="add-alarm-content">
          <TextField
            variant="big"
            label="상대 인스타그램 ID"
            labelOption="sustain"
            value={targetInstagramId}
            onChange={(event) => setTargetInstagramId(event.target.value)}
            placeholder="예: abcd1234"
            right={
              targetInstagramId ? (
                <button
                  type="button"
                  onClick={handleClearTargetId}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label="지우기"
                >
                  <Asset.Icon
                    frameShape={Asset.frameShape.CleanW20}
                    backgroundColor="transparent"
                    name="icon-x-mono"
                    color={adaptive.greyOpacity600}
                    aria-hidden={true}
                    ratio="1/1"
                  />
                </button>
              ) : null
            }
          />

        <Spacing size={12} />

          <div className="clone-manage-create-field">
            <label className="clone-manage-create-label">알람 목록에서 불러오기</label>
            {alarmTargets.length > 0 ? (
              <div className="other-clone-alarm-chips" aria-label="알람 목록 상대 선택">
                {alarmTargets.map((targetId) => (
                  <button
                    key={targetId}
                    type="button"
                    className={normalizedTargetId === targetId ? 'selected' : ''}
                    onClick={() => setTargetInstagramId(targetId)}
                  >
                    @{targetId}
                  </button>
                ))}
              </div>
            ) : (
              <p className="clone-manage-create-hint">아직 불러올 알람이 없어요. 직접 입력해 주세요.</p>
            )}
          </div>

        <Spacing size={12} />

          <div className="clone-manage-create-field">
            <label className="clone-manage-create-label">상대 성별</label>
            <div className="clone-manage-options">
              {['남성', '여성'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`clone-manage-option${targetGender === option ? ' selected' : ''}`}
                  onClick={() => setTargetGender(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="clone-manage-create-hint">상대 클론 소개와 말투 톤을 맞추는 데 사용돼요.</p>
          </div>
      </div>

      <Spacing size={12} />

      <List>
        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                AI 클론 대화 동의
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                내 클론과 상대 클론이 대화할 수 있어요
              </Text>
            </div>
          }
          right={
            <Switch
              checked={allowCloneConversation}
              onChange={() => setAllowCloneConversation((prev) => !prev)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />
        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                상대 클론 활성화 여부
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                상대 클론이 없으면 확인할 수 없어요.
              </Text>
            </div>
          }
          right={
            <Switch
              checked={confirmedActiveClone}
              onChange={() => setConfirmedActiveClone((prev) => !prev)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>
      <div className="clone-manage-info-box" role="note">
        <ul className="clone-manage-info-list">
          <li><span aria-hidden>•</span><span>상대 클론이 활성화된 경우에만 확인할 수 있어요.</span></li>
          <li><span aria-hidden>•</span><span>공개 정보와 선택한 성별을 참고해요.</span></li>
          <li><span aria-hidden>•</span><span>동의한 클론끼리만 대화를 시뮬레이션해요.</span></li>
          <li><span aria-hidden>•</span><span>상대에게 알림이나 DM이 가지 않아요.</span></li>
          <li><span aria-hidden>•</span><span>대화 결과는 참고용이며 언제든 다시 선택할 수 있어요.</span></li>
        </ul>
      </div>
      </div>

      <div className="add-alarm-cta-section">
        <Button
          size="xlarge"
          display="block"
          onClick={handleSpecificPreview}
          disabled={!canPreviewSpecific}
        >
          이 상대와 미리 보기
        </Button>
        {import.meta.env.DEV ? (
          <button
            type="button"
            className="clone-manage-preview-link"
            onClick={() => openAiCloneWithState({ otherCloneAction: 'random' })}
          >
            [DEV] 잘 맞는 사람 찾아보기
          </button>
        ) : null}
      </div>
    </div>
  );
}
