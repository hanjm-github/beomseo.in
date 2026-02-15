import { FilePlus2 } from 'lucide-react';
import styles from './notices.module.css';
import { useAuth } from '../../context/AuthContext';
import { useParams, Link } from 'react-router-dom';

export default function EmptyState() {
  const { user } = useAuth();
  const { category = 'school' } = useParams();
  const canCreate = ['admin', 'council', 'student_council'].includes(user?.role);

  return (
    <div className={styles.empty}>
      <FilePlus2 size={32} />
      <h3>아직 등록된 공지가 없습니다.</h3>
      <p className={styles.metaMuted}>첫 공지를 등록해보세요.</p>
      {canCreate ? (
        <Link to={`/notices/${category}/new`} className={styles.btnPrimary}>
          공지 작성
        </Link>
      ) : null}
    </div>
  );
}
