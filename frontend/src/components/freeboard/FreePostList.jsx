import FreePostCard from './FreePostCard';
import styles from './freeboard.module.css';

export default function FreePostList({ items, basePath, isLoading }) {
  if (isLoading) {
    return <div className={styles.placeholder}>불러오는 중...</div>;
  }

  if (!items || items.length === 0) {
    return <div className={styles.empty}>아직 글이 없어요. 첫 글을 작성해보세요!</div>;
  }

  return (
    <div className={styles.listGrid}>
      {items.map((post) => (
        <FreePostCard key={post.id} post={post} to={`${basePath}/${post.id}`} />
      ))}
    </div>
  );
}
