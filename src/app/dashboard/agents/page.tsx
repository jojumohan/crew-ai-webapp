import Header from '@/components/Header/Header';
import StandupRoom from '@/components/StandupRoom/StandupRoom';
import styles from '../page.module.css';

export default function AgentsPage() {
  return (
    <>
      <Header title="Standup Meeting" />
      <div className={styles.page}>
        <StandupRoom />
      </div>
    </>
  );
}
