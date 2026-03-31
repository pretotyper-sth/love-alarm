const ABUSE_WARNING_CONFIRMED_KEY = 'love_alarm_abuse_warning_confirmed';

export function markAbuseWarningConfirmed() {
  localStorage.setItem(ABUSE_WARNING_CONFIRMED_KEY, 'true');
}

export function hasConfirmedAbuseWarning() {
  return localStorage.getItem(ABUSE_WARNING_CONFIRMED_KEY) === 'true';
}
