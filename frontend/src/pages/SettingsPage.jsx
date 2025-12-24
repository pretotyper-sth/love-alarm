import { useState, useEffect } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Switch,
  Spacing,
  Skeleton,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import './SettingsPage.css';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [tossAppEnabled, setTossAppEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 사용자 정보에서 알림 설정 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 최신 사용자 정보 가져오기
        const userData = await api.getUser();
        setPushEnabled(userData.pushEnabled ?? false);
        setTossAppEnabled(userData.tossAppEnabled ?? false);
      } catch (error) {
        console.error('Failed to load settings:', error);
        // 에러 시 로컬 user 정보 사용
        if (user) {
          setPushEnabled(user.pushEnabled ?? false);
          setTossAppEnabled(user.tossAppEnabled ?? false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // 설정 변경 핸들러
  const handleSettingChange = async (field, value) => {
    // Optimistic UI
    if (field === 'pushEnabled') {
      setPushEnabled(value);
    } else {
      setTossAppEnabled(value);
    }

    setIsSaving(true);
    try {
      const updatedUser = await api.updateSettings({ [field]: value });
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to save settings:', error);
      // 롤백
      if (field === 'pushEnabled') {
        setPushEnabled(!value);
      } else {
        setTossAppEnabled(!value);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-page-container">
      <Spacing size={14} />

      <div className="settings-top-section">
        <Top
          title={
            <Top.TitleParagraph 
              size={22} 
              color={adaptive.grey900}
              style={{ fontSize: '22px' }}
            >
              서비스 설정
            </Top.TitleParagraph>
          }
        />
      </div>

      <Spacing size={24} />

      {isLoading ? (
        <Skeleton custom={['listWithIcon']} repeatLastItemCount={2} />
      ) : (
        <List>
          {/* 연결 시 푸시 알림 */}
          <ListRow
            contents={
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                연결 시 푸시 알림
              </Text>
            }
            right={
              <Switch
                checked={pushEnabled}
                disabled={isSaving}
                onChange={() => handleSettingChange('pushEnabled', !pushEnabled)}
              />
            }
            verticalPadding="large"
            horizontalPadding="medium"
          />

          {/* 연결 시 토스 앱 알림 */}
          <ListRow
            contents={
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                연결 시 토스 앱 알림
              </Text>
            }
            right={
              <Switch
                checked={tossAppEnabled}
                disabled={isSaving}
                onChange={() => handleSettingChange('tossAppEnabled', !tossAppEnabled)}
              />
            }
            verticalPadding="large"
            horizontalPadding="medium"
          />
        </List>
      )}

    </div>
  );
}
