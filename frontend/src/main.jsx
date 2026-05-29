/**
 * @file src/main.jsx
 * @description Bootstraps the React runtime and mounts the root application component.
 * Responsibilities:
 * - Initialize the React application tree in the browser entrypoint.
 * - Detect pre-rendered HTML and hydrate instead of creating a fresh root.
 * Key dependencies:
 * - react
 * - react-dom/client
 * - ./App.jsx
 * Side effects:
 * - Interacts with browser runtime APIs.
 * Role in app flow:
 * - Entry point that hands control to App and routed feature modules.
 */
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.jsx'
import { COMMUNITY_BOARD_FEATURE_FLAGS } from './config/env'
import { startFirebaseForegroundMessageListener } from './pwa/firebaseMessaging'

async function preloadPrerenderModules() {
  // Only preload board modules that remain visible in this build.
  await Promise.all([
    import('./pages/MainPage'),
    import('./pages/LoginPage'),
    import('./pages/SignUpPage'),
    import('./pages/Notices'),
    import('./pages/Notices/NoticeCenter/NoticeCenterPage'),
    import('./pages/Notices/BudgetBoard/BudgetBoardPage'),
    import('./pages/Notices/LostFound/LostFoundListView'),
    // Include nested school profile modules so prerender can resolve their lazy routes.
    import('./pages/Notices/SchoolInfo'),
    import('./pages/Notices/SchoolInfo/BeomseoInfoPage'),
    import('./pages/Notices/SchoolInfo/CSHSInfoPage'),
    import('./pages/Community'),
    import('./pages/Community/FreeBoard/FreeBoardListView'),
    COMMUNITY_BOARD_FEATURE_FLAGS['value-pick']
      ? import('./pages/Community/ValuePick/ValuePickListView')
      : null,
    COMMUNITY_BOARD_FEATURE_FLAGS['club-recruit']
      ? import('./pages/Community/ClubRecruit/ClubRecruitListPage')
      : null,
    COMMUNITY_BOARD_FEATURE_FLAGS['subjects']
      ? import('./pages/Community/Subjects/SubjectsListPage')
      : null,
    import('./pages/Community/Petition/PetitionListView'),
    import('./pages/Community/SurveyExchange/SurveyExchangeListView'),
    import('./pages/Community/Vote/VoteListView'),
    COMMUNITY_BOARD_FEATURE_FLAGS['bospi'] ? import('./pages/Community/Bospi/BospiPage') : null,
    COMMUNITY_BOARD_FEATURE_FLAGS['study-with-beomseo']
      ? import('./pages/Community/StudyWithBeomseo/StudyWithBeomseoPage')
      : null,
    import('./pages/Community/GomsolMarket/GomsolMarketListView'),
    COMMUNITY_BOARD_FEATURE_FLAGS['field-trip']
      ? import('./pages/Community/FieldTrip/FieldTripPage')
      : null,
    import('./pages/SchoolLifeInfo'),
    import('./pages/SchoolLifeInfo/SchoolInfoHub/SchoolInfoHub'),
    import('./pages/SchoolLifeInfo/TimetableDownload/TimetableDownloadPage'),
    import('./pages/SchoolLifeInfo/EvaluationPlans/EvaluationPlansPage'),
    import('./pages/SchoolLifeInfo/Meal/MealPage'),
    import('./pages/SchoolLifeInfo/AcademicCalendar/AcademicCalendarPage'),
    import('./pages/SchoolLifeInfo/SportsLeagueCategory/SportsLeagueCategoryPage'),
    import('./pages/PrivacyPolicyPage'),
    import('./pages/TermsOfServicePage'),
    import('./pages/NotFoundPage'),
  ].filter(Boolean));
}

function inlinePrerenderedContent(html, parse) {
  const root = parse(`<div id="__prerender-root">${html}</div>`, { comment: true });
  const container = root.querySelector('#__prerender-root');

  if (!container) {
    return html;
  }

  const hiddenSegments = container.querySelectorAll('div[hidden]');

  hiddenSegments.forEach((hiddenSegment) => {
    const hiddenId = hiddenSegment.getAttribute('id') || '';
    if (!hiddenId.startsWith('S:')) {
      return;
    }

    const boundaryId = `B:${hiddenId.slice(2)}`;
    const template = container.querySelector(`template[id="${boundaryId}"]`);

    if (!template) {
      hiddenSegment.remove();
      return;
    }

    template.insertAdjacentHTML('afterend', hiddenSegment.innerHTML);

    const fallbackNode = template.nextElementSibling;
    if (fallbackNode?.classList?.contains('route-fallback')) {
      fallbackNode.remove();
    }

    template.remove();
    hiddenSegment.remove();
  });

  container.querySelectorAll('script').forEach((scriptNode) => {
    const content = scriptNode.textContent || '';
    if (content.includes('$RC(') || content.includes('$RB=[')) {
      scriptNode.remove();
    }
  });

  container.querySelectorAll('.route-fallback').forEach((fallbackNode) => {
    fallbackNode.remove();
  });

  return container.innerHTML;
}

if (typeof window !== 'undefined') {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const registerServiceWorker = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    };

    window.addEventListener('load', registerServiceWorker, { once: true });
  }

  startFirebaseForegroundMessageListener().catch(() => {});

  const rootElement = document.getElementById('root');

  const app = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  // If the root already has children, the page was pre-rendered — hydrate to
  // attach React event handlers without discarding the existing DOM.
  if (rootElement.hasChildNodes()) {
    hydrateRoot(rootElement, app);
  } else {
    createRoot(rootElement).render(app);
  }
}


export async function prerender(data) {
  const { prerender: prerenderStatic, resumeAndPrerender } = await import('react-dom/static');
  const { createPrerenderHead } = await import('./seo/policy.js');
  const { parse } = await import('node-html-parser');
  await preloadPrerenderModules();

  let { prelude, postponed } = await prerenderStatic(
    <StrictMode>
      <App url={data.url} />
    </StrictMode>,
  );

  while (postponed) {
    ({ prelude, postponed } = await resumeAndPrerender(
      <StrictMode>
        <App url={data.url} />
      </StrictMode>,
      postponed,
    ));
  }

  const rawHtml = await new Response(prelude).text();
  const html = inlinePrerenderedContent(rawHtml, parse);

  return {
    html,
    links: new Set(),
    head: createPrerenderHead(data.url),
  };
}
