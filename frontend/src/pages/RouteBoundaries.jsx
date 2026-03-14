import { Outlet, useParams } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

const NUMERIC_PARAM_PATTERN = /^\d+$/;

export function AllowedParamBoundary({
  param,
  allowedValues,
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryActions,
  showBackButton,
}) {
  const params = useParams();
  const value = params[param];
  const isAllowed = typeof value === 'string' && allowedValues.includes(value);

  if (!isAllowed) {
    return (
      <NotFoundPage
        eyebrow={eyebrow}
        title={title}
        description={description}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        showBackButton={showBackButton}
      />
    );
  }

  return <Outlet />;
}

export function NumericParamBoundary({
  param = 'id',
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryActions,
  showBackButton,
}) {
  const params = useParams();
  const value = params[param];
  const isNumeric = typeof value === 'string' && NUMERIC_PARAM_PATTERN.test(value);

  if (!isNumeric) {
    return (
      <NotFoundPage
        eyebrow={eyebrow}
        title={title}
        description={description}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
        showBackButton={showBackButton}
      />
    );
  }

  return <Outlet />;
}
