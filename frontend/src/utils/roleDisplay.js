/**
 * @file src/utils/roleDisplay.js
 * @description Hosts utility helpers reused across UI and feature modules.
 * Responsibilities:
 * - Encapsulate file-local responsibilities in support of the overall frontend architecture.
 * Key dependencies:
 * - Module-local logic without direct import dependencies.
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Participates as a supporting module in the frontend runtime graph.
 */
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
  anonymous: {
    // Field-trip posts can be written without login after board unlock.
    prefix: '[비로그인]',
    className: 'role-anonymous',
  },
  student: {
    prefix: '',
    className: 'role-student',
  },
};

const ROLE_ALIASES = {
  council: 'student_council',
  studentcouncil: 'student_council',
  'student-council': 'student_council',
  'student council': 'student_council',
};

const normalizeRole = (role) => {
  if (!role) return 'student';
  const raw = String(role).trim().toLowerCase();
  if (!raw) return 'student';

  if (ROLE_MAP[raw]) return raw;
  if (ROLE_ALIASES[raw]) return ROLE_ALIASES[raw];

  const normalized = raw.replace(/[\s-]+/g, '_');
  if (ROLE_MAP[normalized]) return normalized;
  if (ROLE_ALIASES[normalized]) return ROLE_ALIASES[normalized];

  return 'student';
};

/**
 * @param {Object} params
 * @param {string} params.role
 * @param {string} params.nickname
 * @param {boolean} [params.showPrefix=true]
 * @param {string} [params.prefixOverride]
 */
/**
 * getRoleDisplay module entry point.
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


