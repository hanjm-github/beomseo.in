import { FIELD_TRIP_TABS } from '../../features/fieldTrip/constants';
import styles from '../../pages/FieldTrip/FieldTripPage.module.css';

export default function FieldTripTabBar({ activeTab, onChange }) {
  return (
    <div className={styles.tabShell}>
      <div className="tab-row" role="tablist" aria-label="수학여행 섹션">
        {FIELD_TRIP_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`chip ${styles.tabChip} ${activeTab === tab.key ? 'chip-active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
