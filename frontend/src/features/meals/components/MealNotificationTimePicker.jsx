import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { useMemo } from 'react';

import styles from './MealNotificationTimePicker.module.css';
import {
  composeMealNotificationTime,
  DEFAULT_MEAL_NOTIFICATION_TIME,
  getMealNotificationTimeContext,
  MEAL_NOTIFICATION_HOUR_OPTIONS,
  MEAL_NOTIFICATION_MINUTE_OPTIONS,
  MEAL_NOTIFICATION_TIME_STEP_MINUTES,
  normalizeMealNotificationTime,
  parseMealNotificationTime,
  shiftMealNotificationTime,
} from '../notificationTime';

function formatHourLabel(hour) {
  return `${String(hour).padStart(2, '0')}시`;
}

function formatMinuteLabel(minute) {
  return `${String(minute).padStart(2, '0')}분`;
}

export default function MealNotificationTimePicker({
  value,
  onChange,
  disabled = false,
}) {
  const normalizedValue = useMemo(
    () => normalizeMealNotificationTime(value, DEFAULT_MEAL_NOTIFICATION_TIME),
    [value],
  );
  const selectedMinuteOfDay = useMemo(
    () => parseMealNotificationTime(normalizedValue) ?? 450,
    [normalizedValue],
  );
  const selectedHour = Math.floor(selectedMinuteOfDay / 60);
  const selectedMinute = selectedMinuteOfDay % 60;
  const timeContext = useMemo(
    () => getMealNotificationTimeContext(normalizedValue),
    [normalizedValue],
  );

  const commitNextValue = (nextValue) => {
    if (disabled || typeof onChange !== 'function') {
      return;
    }

    onChange(normalizeMealNotificationTime(nextValue, normalizedValue));
  };

  const handleShift = (deltaMinutes) => {
    commitNextValue(shiftMealNotificationTime(normalizedValue, deltaMinutes));
  };

  const handleHourSelect = (hour) => {
    commitNextValue(composeMealNotificationTime(hour, selectedMinute));
  };

  const handleMinuteSelect = (minute) => {
    commitNextValue(composeMealNotificationTime(selectedHour, minute));
  };

  return (
    <div className={styles.pickerShell}>
      <div className={styles.readoutCard}>
        <div className={styles.readoutHeader}>
          <div className={styles.readoutCopy}>
            <span className={styles.readoutEyebrow}>직접 시간 선택</span>
            <div className={styles.readoutTimeRow}>
              <Clock3 size={18} aria-hidden="true" />
              <strong className={styles.readoutTime}>{normalizedValue}</strong>
            </div>
          </div>
          <span className={styles.readoutBadge}>{timeContext.label}</span>
        </div>

        <p className={styles.readoutDescription}>{timeContext.description}</p>

        <div className={styles.nudgeRow} role="group" aria-label="알림 시간을 5분 단위로 미세 조정">
          <button
            type="button"
            className={styles.nudgeButton}
            onClick={() => handleShift(-MEAL_NOTIFICATION_TIME_STEP_MINUTES)}
            disabled={disabled}
            aria-label="알림 시간을 5분 앞당기기"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            5분 빠르게
          </button>
          <button
            type="button"
            className={styles.nudgeButton}
            onClick={() => handleShift(MEAL_NOTIFICATION_TIME_STEP_MINUTES)}
            disabled={disabled}
            aria-label="알림 시간을 5분 늦추기"
          >
            5분 늦게
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.selectorGrid}>
        <section className={styles.selectorCard} aria-labelledby="meal-notification-hour-picker">
          <div className={styles.selectorHeader}>
            <span id="meal-notification-hour-picker" className={styles.selectorLabel}>시간</span>
            <span className={styles.selectorValue}>{formatHourLabel(selectedHour)}</span>
          </div>
          <div className={styles.hourRail} role="group" aria-label="알림 시각의 시간을 선택">
            {MEAL_NOTIFICATION_HOUR_OPTIONS.map((hour) => {
              const isActive = hour === selectedHour;

              return (
                <button
                  key={hour}
                  type="button"
                  className={`${styles.hourChip} ${isActive ? styles.hourChipActive : ''}`}
                  onClick={() => handleHourSelect(hour)}
                  disabled={disabled}
                  aria-pressed={isActive}
                >
                  {String(hour).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.selectorCard} aria-labelledby="meal-notification-minute-picker">
          <div className={styles.selectorHeader}>
            <span id="meal-notification-minute-picker" className={styles.selectorLabel}>분</span>
            <span className={styles.selectorValue}>{formatMinuteLabel(selectedMinute)}</span>
          </div>
          <div className={styles.minuteGrid} role="group" aria-label="알림 시각의 분을 선택">
            {MEAL_NOTIFICATION_MINUTE_OPTIONS.map((minute) => {
              const isActive = minute === selectedMinute;

              return (
                <button
                  key={minute}
                  type="button"
                  className={`${styles.minuteChip} ${isActive ? styles.minuteChipActive : ''}`}
                  onClick={() => handleMinuteSelect(minute)}
                  disabled={disabled}
                  aria-pressed={isActive}
                >
                  {String(minute).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
