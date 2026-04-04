/**
 * @file src/components/Community/ValuePick/ValuePickPostList.jsx
 */
import ValuePickPostCard from './ValuePickPostCard';
import styles from './valuepick.module.css';

export default function ValuePickPostList({ items, basePath, isLoading }) {
  if (isLoading) {
    return <div className={styles.placeholder}>다짐 기록을 불러오는 중입니다...</div>;
  }

  if (!items || items.length === 0) {
    return (
      <div className={styles.empty}>
        아직 등록된 다짐이 없어요. 올해 실천할 인성 가치를 가장 먼저 남겨보세요.
      </div>
    );
  }

  return (
    <div className={styles.listGrid}>
      {items.map((post) => (
        <ValuePickPostCard key={post.id} post={post} to={`${basePath}/${post.id}`} />
      ))}
    </div>
  );
}
