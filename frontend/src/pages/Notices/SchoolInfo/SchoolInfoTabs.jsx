/**
 * @file src/pages/Notices/SchoolInfo/SchoolInfoTabs.jsx
 * @description Shared tabs for switching between static school profile pages.
 */
import { Link, useLocation } from 'react-router-dom';

import styles from './SchoolInfoTabs.module.css';

// Keep labels and paths in one list so rendered tabs and active matching cannot drift apart.
const SCHOOL_INFO_TABS = [
  { key: 'beomseo', label: '범서고', path: '/notices/school-info/bshs-info' },
  { key: 'cshs', label: '천상고', path: '/notices/school-info/cshs-info' },
];

function isActivePath(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function SchoolInfoTabs() {
  const { pathname } = useLocation();

  return (
    <nav className={styles.tabs} aria-label="학교 소개 전환">
      {SCHOOL_INFO_TABS.map((tab) => {
        const active = isActivePath(pathname, tab.path);

        return (
          <Link
            key={tab.key}
            to={tab.path}
            className={`${styles.tab} ${active ? styles.active : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
