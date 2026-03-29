/**
 * @file src/pages/NoticesPage/BudgetBoardPage.jsx
 * @description Budget disclosure board shell with cycle/year navigation.
 * Responsibilities:
 * - Render the budget board header, year switcher, and month tabs.
 * - Route month-scoped list/detail/compose pages under `/notices/budget/*`.
 * Key dependencies:
 * - react
 * - react-router-dom
 * - lucide-react
 * - ../../../api/notices
 * Side effects:
 * - Influences client-side routing and navigation state.
 * Role in app flow:
 * - Owns the budget disclosure experience.
 */
import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, CalendarRange } from 'lucide-react';
import NotFoundPage from '../../NotFoundPage';
import { NumericParamBoundary } from '../../RouteBoundaries';
import { useAuth } from '../../../context/AuthContext';
import { noticesApi } from '../../../api/notices';
import '../../page-shell.css';
import BudgetListView from './BudgetListView';
import BudgetDetailView from './BudgetDetailView';
import BudgetComposeView from './BudgetComposeView';
import {
  BUDGET_MONTHS,
  buildBudgetListPath,
  clampBudgetYear,
  formatBudgetCycleLabel,
  formatBudgetMonthLabel,
  formatBudgetPeriodLabel,
  getCurrentBudgetRouteParams,
  hasExpectedBudgetMonthOrder,
  isBudgetYearInRange,
  normalizeBudgetMonthValue,
} from './budgetUtils';
import styles from './BudgetBoardPage.module.css';

function getFallbackBudgetSettings() {
  const fallback = getCurrentBudgetRouteParams();
  // Keep the board navigable even when the settings request fails by collapsing
  // to a single cycle around the current route-derived budget period.
  return {
    startYear: Number(fallback.budgetYear),
    endYear: Number(fallback.budgetYear),
    monthOrder: BUDGET_MONTHS,
    currentBudgetYear: Number(fallback.budgetYear),
    currentBudgetMonth: fallback.budgetMonth,
    defaultBudgetYear: Number(fallback.budgetYear),
    defaultBudgetMonth: fallback.budgetMonth,
  };
}

function YearNavControl({ to, label, disabled, children }) {
  if (disabled) {
    return (
      <span className={`${styles.yearButton} ${styles.yearButtonDisabled}`} aria-label={label} aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <Link className={styles.yearButton} to={to} aria-label={label}>
      {children}
    </Link>
  );
}

/**
 * BudgetBoardPage module entry point.
 */
export default function BudgetBoardPage() {
  const location = useLocation();
  const { user } = useAuth();
  const canCreate = ['admin', 'student_council'].includes(user?.role);

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    noticesApi
      .getBudgetSettings()
      .then((response) => {
        if (cancelled) return;
        setSettings(response);
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setSettings(getFallbackBudgetSettings());
        setError('예산 공개 설정을 불러오지 못해 기본 설정으로 표시합니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSettings = useMemo(() => {
    if (!settings) return null;
    // The UI only supports the fixed March-February cycle order, so normalize
    // the payload first and fail closed if the server shape is unexpected.
    return {
      ...settings,
      startYear: Number(settings.startYear),
      endYear: Number(settings.endYear),
      currentBudgetYear: Number(settings.currentBudgetYear),
      currentBudgetMonth: normalizeBudgetMonthValue(settings.currentBudgetMonth),
      defaultBudgetYear: Number(settings.defaultBudgetYear),
      defaultBudgetMonth: normalizeBudgetMonthValue(settings.defaultBudgetMonth),
      monthOrder: Array.isArray(settings.monthOrder) ? settings.monthOrder : BUDGET_MONTHS,
    };
  }, [settings]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="card surface">
          <div className="placeholder">예산 공개 설정을 불러오는 중입니다.</div>
        </div>
      </div>
    );
  }

  if (!normalizedSettings || !hasExpectedBudgetMonthOrder(normalizedSettings.monthOrder)) {
    return (
      <NotFoundPage
        eyebrow="예산 공개"
        title="예산 공개 설정을 불러올 수 없습니다."
        description="게시판 설정이 올바르지 않아 화면을 표시할 수 없습니다."
        primaryAction={{ label: '학교 공지', to: '/notices/school' }}
      />
    );
  }

  const budgetPathSegments = location.pathname.split('/').filter(Boolean);
  const isBudgetRootPath = location.pathname.replace(/\/+$/, '') === '/notices/budget';
  const routeBudgetYear = budgetPathSegments[2] || null;
  const routeBudgetMonth = budgetPathSegments[3] || null;

  if (isBudgetRootPath) {
    // The backend owns the default landing cycle/month so direct `/budget`
    // visits always resolve to the currently active board window.
    return (
      <Navigate
        to={buildBudgetListPath(
          normalizedSettings.defaultBudgetYear,
          normalizedSettings.defaultBudgetMonth
        )}
        replace
      />
    );
  }

  const normalizedRouteMonth = normalizeBudgetMonthValue(routeBudgetMonth);
  const isValidRouteYear = isBudgetYearInRange(
    routeBudgetYear,
    normalizedSettings.startYear,
    normalizedSettings.endYear
  );
  const isValidRouteMonth = normalizedSettings.monthOrder.includes(normalizedRouteMonth || '');

  if (!isValidRouteYear || !isValidRouteMonth) {
    return (
      <NotFoundPage
        eyebrow="예산 공개"
        title="존재하지 않는 예산 공개 경로입니다."
        description={`예산 공개는 ${normalizedSettings.startYear}년부터 ${normalizedSettings.endYear}년까지의 활성 회계연도만 지원합니다.`}
        primaryAction={{
          label: '예산 공개 기본 화면',
          to: buildBudgetListPath(
            normalizedSettings.defaultBudgetYear,
            normalizedSettings.defaultBudgetMonth
          ),
        }}
      />
    );
  }

  const activeBudgetYear = Number(routeBudgetYear);
  const activeBudgetMonth = normalizedRouteMonth;
  const activeListPath = buildBudgetListPath(activeBudgetYear, activeBudgetMonth);
  const previousYear = clampBudgetYear(
    activeBudgetYear - 1,
    normalizedSettings.startYear,
    normalizedSettings.endYear
  );
  const nextYear = clampBudgetYear(
    activeBudgetYear + 1,
    normalizedSettings.startYear,
    normalizedSettings.endYear
  );

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">예산 공개</p>
          <h1>예산 공개 게시판</h1>
          <p className="lede">학생회 예산 집행과 지출 내역을 월별로 투명하게 확인하세요.</p>
        </div>
        <div className="header-actions">
          {canCreate ? (
            <Link className="btn btn-primary" to={`${activeListPath}/new`}>
              <Plus size={16} />
              글 작성
            </Link>
          ) : null}
        </div>
      </div>

      <div className={styles.budgetHeader}>
        {error ? <p className="muted">{error}</p> : null}

        <div className={styles.yearSelector}>
          <YearNavControl
            to={buildBudgetListPath(previousYear, activeBudgetMonth)}
            label="이전 예산 연도 보기"
            disabled={activeBudgetYear <= normalizedSettings.startYear}
          >
            <ChevronLeft size={18} />
          </YearNavControl>

          <div className={styles.yearSummary}>
            <h2 className={styles.yearLabel}>{activeBudgetYear} 예산 공개</h2>
            <p className={styles.yearHint}>{formatBudgetCycleLabel(activeBudgetYear)}</p>
          </div>

          <YearNavControl
            to={buildBudgetListPath(nextYear, activeBudgetMonth)}
            label="다음 예산 연도 보기"
            disabled={activeBudgetYear >= normalizedSettings.endYear}
          >
            <ChevronRight size={18} />
          </YearNavControl>
        </div>

        <div className="tab-row">
          {normalizedSettings.monthOrder.map((budgetMonth) => {
            const monthPath = buildBudgetListPath(activeBudgetYear, budgetMonth);
            const isActive = budgetMonth === activeBudgetMonth;

            return (
              <Link
                key={budgetMonth}
                to={monthPath}
                className={`chip ${isActive ? 'chip-active' : ''} ${styles.monthChip}`}
              >
                {formatBudgetMonthLabel(budgetMonth)}
              </Link>
            );
          })}
        </div>

        <div className={styles.monthMetaCard}>
          <CalendarRange size={16} />
          <span>
            현재 보기{' '}
            <span className={styles.monthMetaStrong}>
              {formatBudgetPeriodLabel(activeBudgetYear, activeBudgetMonth)}
            </span>
          </span>
        </div>
      </div>

      <Routes>
        <Route path=":budgetYear/:budgetMonth" element={<BudgetListView />} />
        <Route path=":budgetYear/:budgetMonth/new" element={<BudgetComposeView mode="create" />} />
        <Route
          element={
            <NumericParamBoundary
              eyebrow="예산 공개"
              title="유효하지 않은 글 경로입니다."
              description="상세 경로의 게시글 번호는 숫자 경로만 지원합니다."
              primaryAction={{
                label: '예산 공개 기본 화면',
                to: buildBudgetListPath(
                  normalizedSettings.defaultBudgetYear,
                  normalizedSettings.defaultBudgetMonth
                ),
              }}
            />
          }
        >
          <Route path=":budgetYear/:budgetMonth/:id" element={<BudgetDetailView />} />
          <Route path=":budgetYear/:budgetMonth/:id/edit" element={<BudgetComposeView mode="edit" />} />
        </Route>
        <Route
          path="*"
          element={
            <NotFoundPage
              eyebrow="예산 공개"
              title="존재하지 않는 예산 공개 경로입니다."
              description="예산 연도와 월 경로를 다시 확인해 주세요."
              primaryAction={{
                label: '예산 공개 기본 화면',
                to: buildBudgetListPath(
                  normalizedSettings.defaultBudgetYear,
                  normalizedSettings.defaultBudgetMonth
                ),
              }}
            />
          }
        />
      </Routes>
    </div>
  );
}
