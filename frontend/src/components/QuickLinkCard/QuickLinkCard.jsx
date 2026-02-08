import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import styles from './QuickLinkCard.module.css';

export default function QuickLinkCard({
    to,
    icon: Icon,
    title,
    description,
    variant = 'default',
    size = 'medium'
}) {
    return (
        <Link to={to} className={`${styles.card} ${styles[variant]} ${styles[size]}`}>
            <motion.div
                className={styles.inner}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
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
            </motion.div>
        </Link>
    );
}
