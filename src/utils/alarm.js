import { storage, STORAGE_KEYS } from './storage';

// 알람 데이터 구조
// { id, myId, targetId, createdAt, matched: boolean }

export const alarmService = {
  // 모든 알람 가져오기
  getAllAlarms: () => {
    return storage.get(STORAGE_KEYS.ALARMS) || [];
  },

  // 알람 추가
  addAlarm: (myId, targetId) => {
    const alarms = alarmService.getAllAlarms();
    const newAlarm = {
      id: Date.now().toString(),
      myId: myId.trim(),
      targetId: targetId.trim(),
      createdAt: new Date().toISOString(),
      matched: false,
    };
    alarms.push(newAlarm);
    storage.set(STORAGE_KEYS.ALARMS, alarms);
    
    // 첫 알람 사용 여부 체크
    const firstUsed = storage.get(STORAGE_KEYS.FIRST_ALARM_USED);
    if (!firstUsed) {
      storage.set(STORAGE_KEYS.FIRST_ALARM_USED, true);
    }
    
    // 알람 개수 증가
    const count = storage.get(STORAGE_KEYS.ALARM_COUNT) || 0;
    storage.set(STORAGE_KEYS.ALARM_COUNT, count + 1);
    
    // 매칭 확인
    alarmService.checkMatching(newAlarm);
    
    return newAlarm;
  },

  // 알람 삭제
  removeAlarm: (id) => {
    const alarms = alarmService.getAllAlarms();
    const filtered = alarms.filter(alarm => alarm.id !== id);
    storage.set(STORAGE_KEYS.ALARMS, filtered);
  },

  // 매칭 확인 (양방향 알람 체크)
  checkMatching: (newAlarm) => {
    const alarms = alarmService.getAllAlarms();
    
    // 상대방이 나에게 알람을 울렸는지 확인
    const reverseAlarm = alarms.find(
      alarm => 
        alarm.myId === newAlarm.targetId && 
        alarm.targetId === newAlarm.myId &&
        !alarm.matched
    );
    
    if (reverseAlarm) {
      // 매칭 성공!
      const updatedAlarms = alarms.map(alarm => {
        if (alarm.id === newAlarm.id || alarm.id === reverseAlarm.id) {
          return { ...alarm, matched: true };
        }
        return alarm;
      });
      storage.set(STORAGE_KEYS.ALARMS, updatedAlarms);
      return true;
    }
    
    return false;
  },

  // 매칭된 알람 확인 (앱 시작 시 전체 체크)
  checkAllMatchings: () => {
    const alarms = alarmService.getAllAlarms();
    let hasNewMatch = false;
    
    const unmatchedAlarms = alarms.filter(alarm => !alarm.matched);
    
    for (const alarm of unmatchedAlarms) {
      const reverseAlarm = unmatchedAlarms.find(
        a => a.myId === alarm.targetId && a.targetId === alarm.myId
      );
      
      if (reverseAlarm) {
        hasNewMatch = true;
        const updatedAlarms = alarms.map(a => {
          if (a.id === alarm.id || a.id === reverseAlarm.id) {
            return { ...a, matched: true };
          }
          return a;
        });
        storage.set(STORAGE_KEYS.ALARMS, updatedAlarms);
      }
    }
    
    return hasNewMatch;
  },

  // 첫 알람 사용 여부 확인
  isFirstAlarmFree: () => {
    return !storage.get(STORAGE_KEYS.FIRST_ALARM_USED);
  },

  // 알람 개수 가져오기
  getAlarmCount: () => {
    return storage.get(STORAGE_KEYS.ALARM_COUNT) || 0;
  },
};




