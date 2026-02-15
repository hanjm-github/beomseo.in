/**
 * Role display mapping utility.
 * Normalizes role strings and returns prefix + class names for UI rendering.
 */
const ROLE_MAP = {
  admin: {
    prefix: '[관리자]',
    className: 'role-admin',
  },
  student_council: {
    prefix: '[학생회]',
    className: 'role-student-council',
  },
  teacher: {
    prefix: '[교사]',
    className: 'role-teacher',
  },
  student: {
    prefix: '',
    className: 'role-student',
  },
};

const normalizeRole = (role) => {
  if (!role) return 'student';
  const lower = String(role).toLowerCase();
  return ROLE_MAP[lower] ? lower : 'student';
};

/**
 * @param {Object} params
 * @param {string} params.role
 * @param {string} params.nickname
 * @param {boolean} [params.showPrefix=true]
 * @param {string} [params.prefixOverride]
 */
export function getRoleDisplay({ role, nickname, showPrefix = true, prefixOverride }) {
  const safeNickname = nickname || '';
  const normalized = normalizeRole(role);
  const map = ROLE_MAP[normalized];

  const displayPrefix = showPrefix ? (prefixOverride ?? map.prefix) : '';
  const ariaLabel = displayPrefix
    ? `${displayPrefix} ${safeNickname}`.trim()
    : safeNickname;

  return {
    displayPrefix,
    ariaLabel,
    roleClassName: map.className,
    safeNickname,
  };
}

export default getRoleDisplay;
