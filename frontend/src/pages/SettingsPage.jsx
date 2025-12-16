import { useState } from 'react';
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
import './SettingsPage.css';

// 알림 설정 키
const NOTIFICATION_SETTINGS_KEY = 'love_alarm_notification_settings';

// 알림 설정 가져오기
export function getNotificationSettings() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to get notification settings:', e);
  }
  return { pushNotification: false, tossAppNotification: false };
}

// 알림 설정 저장하기
export function setNotificationSettings(settings) {
  try {
    localStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save notification settings:', e);
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  
  // localStorage에서 초기값 로드 (기본값: false)
  const savedSettings = getNotificationSettings();
  const [pushNotification, setPushNotification] = useState(savedSettings.pushNotification);
  const [tossAppNotification, setTossAppNotification] = useState(savedSettings.tossAppNotification);

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
              checked={pushNotification}
              onChange={() => {
                const newValue = !pushNotification;
                setPushNotification(newValue);
                setNotificationSettings({ pushNotification: newValue, tossAppNotification });
              }}
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
              checked={tossAppNotification}
              onChange={() => {
                const newValue = !tossAppNotification;
                setTossAppNotification(newValue);
                setNotificationSettings({ pushNotification, tossAppNotification: newValue });
              }}
            />
          }
          verticalPadding="large"
          horizontalPadding="medium"
        />
      </List>

    </div>
  );
}

