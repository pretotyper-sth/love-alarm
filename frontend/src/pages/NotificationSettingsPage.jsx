import { useState, useEffect } from 'react';
import {
  Text,
  Top,
  List,
  ListRow,
  Switch,
  Spacing,
} from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import {
  loadUnreadMessageBadgeEnabled,
  saveUnreadMessageBadgeEnabled,
} from '../utils/messages';
import { logScreen, logClick } from '../utils/analytics';
import './SettingsPage.css';

export function NotificationSettingsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(user?.pushEnabled ?? false);
  const [tossAppEnabled, setTossAppEnabled] = useState(user?.tossAppEnabled ?? false);
  const [messagePushEnabled, setMessagePushEnabled] = useState(user?.messagePushEnabled ?? false);
  const [messageTossAppEnabled, setMessageTossAppEnabled] = useState(user?.messageTossAppEnabled ?? false);
  const [unreadMessageBadgeEnabled, setUnreadMessageBadgeEnabled] = useState(() => loadUnreadMessageBadgeEnabled());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const syncSettings = async () => {
      try {
        const userData = await api.getUser();
        setPushEnabled(userData.pushEnabled ?? false);
        setTossAppEnabled(userData.tossAppEnabled ?? false);
        setMessagePushEnabled(userData.messagePushEnabled ?? false);
        setMessageTossAppEnabled(userData.messageTossAppEnabled ?? false);
      } catch (error) {
        console.error('Failed to sync settings:', error);
      }
    };
    syncSettings();
  }, []);

  useEffect(() => {
    logScreen('notification_settings_screen');
  }, []);

  const SETTING_SETTERS = {
    pushEnabled: setPushEnabled,
    tossAppEnabled: setTossAppEnabled,
    messagePushEnabled: setMessagePushEnabled,
    messageTossAppEnabled: setMessageTossAppEnabled,
  };

  const handleSettingChange = async (field, value) => {
    logClick('notification_toggle_change', { field, value });
    const setter = SETTING_SETTERS[field];
    if (!setter) return;

    setter(value);
    setIsSaving(true);
    try {
      const updatedUser = await api.updateSettings({ [field]: value });
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setter(!value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnreadMessageBadgeToggle = () => {
    const nextValue = !unreadMessageBadgeEnabled;
    setUnreadMessageBadgeEnabled(nextValue);
    saveUnreadMessageBadgeEnabled(nextValue);
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
              fontWeight="bold"
              style={{ fontSize: '22px' }}
            >
              알림 설정
            </Top.TitleParagraph>
          }
          onBackClick={() => navigate(-1)}
        />
      </div>

      <Spacing size={24} />

      <List>
        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                연결 시 푸시 알림
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                서로 알람을 등록하면 푸시로 알려드려요
              </Text>
            </div>
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

        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                연결 시 토스 앱 알림
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                서로 알람을 등록하면 토스 앱에서 알려드려요
              </Text>
            </div>
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

        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                메시지 수신 시 푸시 알림
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                메시지를 받으면 푸시로 알려드려요
              </Text>
            </div>
          }
          right={
            <Switch
              checked={messagePushEnabled}
              disabled={isSaving}
              onChange={() => handleSettingChange('messagePushEnabled', !messagePushEnabled)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />

        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                메시지 수신 시 토스 앱 알림
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                메시지를 받으면 토스 앱에서 알려드려요
              </Text>
            </div>
          }
          right={
            <Switch
              checked={messageTossAppEnabled}
              disabled={isSaving}
              onChange={() => handleSettingChange('messageTossAppEnabled', !messageTossAppEnabled)}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />

        <ListRow
          contents={
            <div>
              <Text color="#4e5968" typography="t5" fontWeight="semibold">
                읽지 않은 메시지 배지 표시
              </Text>
              <Text color="#8b95a1" typography="t7" style={{ marginTop: 2 }}>
                안 읽은 메시지가 있으면 아이콘에 표시해요
              </Text>
            </div>
          }
          right={
            <Switch
              checked={unreadMessageBadgeEnabled}
              onChange={handleUnreadMessageBadgeToggle}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>
    </div>
  );
}
