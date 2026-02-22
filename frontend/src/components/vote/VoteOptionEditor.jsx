/**
 * @file src/components/vote/VoteOptionEditor.jsx
 * @description Defines reusable UI components and feature-specific interaction blocks.
 * Responsibilities:
 * - Render composable UI pieces with clear prop-driven behavior and minimal coupling.
 * Key dependencies:
 * - lucide-react
 * - ./vote.module.css
 * Side effects:
 * - No significant side effects beyond React state and rendering behavior.
 * Role in app flow:
 * - Implements reusable view logic consumed by route-level pages.
 */
import { Plus, Trash2 } from 'lucide-react';
import styles from './vote.module.css';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

/**
 * VoteOptionEditor module entry point.
 */
export default function VoteOptionEditor({ options, onChange }) {
  const updateOption = (id, text) => {
    onChange(options.map((option) => (option.id === id ? { ...option, text } : option)));
  };

  const removeOption = (id) => {
    if (options.length <= MIN_OPTIONS) return;
    onChange(options.filter((option) => option.id !== id));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    onChange([
      ...options,
      {
        id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: '',
      },
    ]);
  };

  return (
    <div className={styles.optionEditor}>
      {options.map((option, index) => (
        <div className={styles.optionEditorRow} key={option.id}>
          <span className={styles.optionOrder} aria-hidden="true">
            {index + 1}
          </span>
          <input
            className={styles.optionInput}
            value={option.text}
            onChange={(e) => updateOption(option.id, e.target.value)}
            placeholder={`선택지 ${index + 1}`}
            maxLength={80}
            required
          />
          <button
            type="button"
            className={styles.optionRemove}
            onClick={() => removeOption(option.id)}
            disabled={options.length <= MIN_OPTIONS}
            aria-label={`선택지 ${index + 1} 삭제`}
            title="선택지 삭제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.optionAdd}
        onClick={addOption}
        disabled={options.length >= MAX_OPTIONS}
      >
        <Plus size={16} />
        선택지 추가
      </button>
      <p className={styles.optionRule}>선택지는 최소 2개, 최대 8개까지 입력할 수 있습니다.</p>
    </div>
  );
}



