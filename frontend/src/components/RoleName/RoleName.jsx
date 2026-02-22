/**
 * @file src/components/RoleName/RoleName.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react
 * - ../../utils/roleDisplay
 * - ./RoleName.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import React from 'react';
import { getRoleDisplay } from '../../utils/roleDisplay';
import styles from './RoleName.module.css';

const cx = (...args) => args.filter(Boolean).join(' ');

/**
 * Role-aware name renderer with prefixes and styling.
 * Usage:
 *   <RoleName nickname="홍길동" role="admin" />
 *   <RoleName nickname="김교사" role="teacher" showPrefix={false} size="sm" />
 */
export default function RoleName({
  nickname,
  role,
  showPrefix = true,
  size = 'md',
  className,
  as = 'span',
  prefixOverride,
  ellipsis = false,
}) {
  const Component = as;

  const { displayPrefix, ariaLabel, roleClassName, safeNickname } = getRoleDisplay({
    role,
    nickname,
    showPrefix,
    prefixOverride,
  });

  return (
    <Component className={cx(styles.roleName, styles[`size-${size}`], className)} aria-label={ariaLabel}>
      {displayPrefix && (
        <span className={cx(styles.prefix, styles[roleClassName])}>{displayPrefix}</span>
      )}
      <span className={cx(styles.name, styles[roleClassName], ellipsis && styles.ellipsis)} title={safeNickname}>
        {safeNickname}
      </span>
    </Component>
  );
}


