/**
 * @file src/components/notices/EmptyState.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./notices.module.css
 * - ../../context/AuthContext
 * - react-router-dom
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { FilePlus2 } from 'lucide-react';
import styles from './notices.module.css';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link } from 'react-router-dom';

/**
 * EmptyState module entry point.
 */
export default function EmptyState({
  title = '아직 등록된 공지가 없습니다.',
  description = '첫 공지를 등록해보세요.',
  createPath,
}) {
  const { user } = useAuth();
  const { category = 'school' } = useParams();
  const canCreate = ['admin', 'student_council'].includes(user?.role);
  // Shared boards can inject a different CTA target without losing the default
  // category-derived path for school/council notices.
  const resolvedCreatePath = createPath || `/notices/${category}/new`;

  return (
    <div className={styles.empty}>
      <FilePlus2 size={32} />
      <h3>{title}</h3>
      <p className={styles.metaMuted}>{description}</p>
      {canCreate ? (
        <Link to={resolvedCreatePath} className={styles.btnPrimary}>
          공지 작성
        </Link>
      ) : null}
    </div>
  );
}


