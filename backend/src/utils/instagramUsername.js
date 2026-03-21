/**
 * @param {string} raw
 * @returns {string} @ 제거, trim, 소문자
 */
export function normalizeInstagramUsername(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/^@+/, '').toLowerCase();
}
