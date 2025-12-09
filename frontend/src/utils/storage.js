// 로컬 스토리지 유틸리티
export const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Storage set error:', error);
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Storage remove error:', error);
    }
  },
};

// 알람 관련 스토리지 키
export const STORAGE_KEYS = {
  ALARMS: 'love_alarm_alarms',
  FIRST_ALARM_USED: 'love_alarm_first_used',
  ALARM_COUNT: 'love_alarm_count',
  CONFETTI_SHOWN: 'love_alarm_confetti_shown',
};

