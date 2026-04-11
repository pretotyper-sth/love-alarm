import { useState, useEffect } from 'react';
import { Text, Top, Spacing } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { logScreen } from '../utils/analytics';
import './CloneConversationsPage.css';

export function CloneConversationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    logScreen('clone_conversations_screen');
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  };

  const getPartnerInstagramId = (conv) => {
    if (!user) return '?';
    const myCloneIsClone1 = conv.clone1?.userId === user.id;
    return myCloneIsClone1 ? conv.clone2?.instagramId : conv.clone1?.instagramId;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#9E9E9E';
  };

  return (
    <div className="clone-convs-page">
      <Top
        title={
          <Top.TitleParagraph size={22} color={adaptive.grey900} fontWeight="bold">
            AI 대화 기록
          </Top.TitleParagraph>
        }
        left={<Top.BackButton onClick={() => navigate(-1)} />}
      />

      <Spacing size={8} />

      <div className="clone-convs-content">
        {loading ? (
          <div className="clone-convs-empty">
            <Text color={adaptive.grey500} typography="t7">불러오는 중...</Text>
          </div>
        ) : conversations.length === 0 ? (
          <div className="clone-convs-empty">
            <Text color={adaptive.grey500} typography="t7">
              아직 AI 대화가 없어요.
            </Text>
            <Spacing size={4} />
            <Text color={adaptive.grey400} typography="t8">
              클론 매칭이 허용되면 자동으로 대화가 시작돼요.
            </Text>
          </div>
        ) : (
          <div className="clone-convs-list">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className="clone-convs-item"
                onClick={() => navigate(`/clone-conversation/${conv.id}`)}
              >
                <div className="clone-convs-item-left">
                  <Text typography="t6" fontWeight="bold" color={adaptive.grey900}>
                    @{getPartnerInstagramId(conv)}
                  </Text>
                  <Spacing size={2} />
                  <Text typography="t8" color={adaptive.grey500}>
                    {formatDate(conv.completedAt)}
                  </Text>
                </div>
                <div className="clone-convs-item-right">
                  {conv.chemistryScore != null && (
                    <div className="clone-convs-score" style={{ color: getScoreColor(conv.chemistryScore) }}>
                      <span className="clone-convs-score-number">
                        {Math.round(conv.chemistryScore)}
                      </span>
                      <span className="clone-convs-score-label">케미</span>
                    </div>
                  )}
                  <span className="clone-convs-arrow">›</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
