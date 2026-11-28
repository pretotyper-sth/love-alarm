// Eligibility exists only after this session's server-confirmed signup.
export function createAddAlarmTutorial(storage) {
  let eligibleUserId = null;
  return {
    start(result) {
      eligibleUserId = result?.isNewUser === true ? result.user?.id ?? null : null;
    },
    claim(userId) {
      if (!userId || userId !== eligibleUserId) return false;
      eligibleUserId = null;
      try {
        const key = `love_alarm_add_tutorial_${userId}`;
        if (storage.getItem(key)) return false;
        storage.setItem(key, 'true');
        return true;
      } catch { return false; }
    },
    clear() { eligibleUserId = null; },
  };
}
