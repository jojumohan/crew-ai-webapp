import Header from '@/components/Header/Header';
import VoiceRoom from '@/components/VoiceRoom/VoiceRoom';
import styles from '../page.module.css';

export default function AgentsPage() {
  return (
    <>
      <Header title="Standup Meeting" />
      <div className={styles.page} style={{ padding: 0, height: '100%' }}>
        <VoiceRoom />
      </div>
    </>
  );
}
