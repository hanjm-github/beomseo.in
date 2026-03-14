import { ArrowLeft, Compass, FileSearch } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './NotFoundPage.module.css';
import './page-shell.css';

const DEFAULT_PRIMARY_ACTION = {
  label: '홈으로',
  to: '/',
};

const DEFAULT_SECONDARY_ACTIONS = [
  { label: '공지 보기', to: '/notices/school' },
];

export default function NotFoundPage({
  eyebrow = '404 Not Found',
  title = '찾을 수 없는 페이지입니다.',
  description = '입력한 주소가 잘못되었거나 페이지가 이동되었습니다. 아래 링크에서 원하는 메뉴로 다시 이동해 주세요.',
  primaryAction = DEFAULT_PRIMARY_ACTION,
  secondaryActions = DEFAULT_SECONDARY_ACTIONS,
  showBackButton = true,
}) {
  const navigate = useNavigate();
  const actionItems = Array.isArray(secondaryActions) ? secondaryActions.filter(Boolean) : [];
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;

  return (
    <div className={`page-shell ${styles.shell}`}>
      <div className={styles.panel}>
        <div className={styles.content}>
          <p className="eyebrow">{eyebrow}</p>
          <div className={styles.codeRow}>
            <div className={styles.code}>404</div>
            <div className={styles.iconWrap} aria-hidden="true">
              <FileSearch size={22} />
            </div>
          </div>

          <h1 className={styles.title}>{title}</h1>
          <p className={styles.description}>{description}</p>

          <div className={styles.meta}>
            <span className={styles.pill}>
              <Compass size={14} />
              현재 주소에서는 콘텐츠를 찾지 못했습니다.
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          {primaryAction?.to && primaryAction?.label ? (
            <Link className={`btn btn-primary ${styles.actionButton}`} to={primaryAction.to}>
              {primaryAction.label}
            </Link>
          ) : null}

          {actionItems.map((action) => (
            <Link
              key={`${action.to}-${action.label}`}
              className={`btn btn-secondary ${styles.actionButton}`}
              to={action.to}
            >
              {action.label}
            </Link>
          ))}

          {showBackButton && canGoBack ? (
            <button
              type="button"
              className={`btn btn-ghost ${styles.actionButton} ${styles.backButton}`}
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={16} />
              이전 페이지
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
