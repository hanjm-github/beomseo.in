/**
 * @file src/components/QuickLinkCard/QuickLinkCard.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - react-router-dom
 * - ./QuickLinkCard.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Link } from 'react-router-dom';
import styles from './QuickLinkCard.module.css';

/**
 * QuickLinkCard module entry point.
 */
export default function QuickLinkCard({
    to,
    icon,
    title,
    description,
    variant = 'default',
    size = 'medium'
}) {
    const Icon = icon;

    return (
        <Link to={to} className={`${styles.card} ${styles[variant]} ${styles[size]}`}>
            <div className={styles.inner}>
                <div className={styles.iconWrapper}>
                    <Icon size={size === 'large' ? 28 : 24} />
                </div>
                <div className={styles.content}>
                    <h3 className={styles.title}>{title}</h3>
                    {description && (
                        <p className={styles.description}>{description}</p>
                    )}
                </div>
                <div className={styles.arrow}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M6 12L10 8L6 4"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            </div>
        </Link>
    );
}


