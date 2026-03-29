import Header from '@/components/Header/Header';
import styles from '../page.module.css';

export default function CalendarPage() {
  return (
    <>
      <Header title="Calendar" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Calendar</h1>
          <p>Upcoming events and deadlines.</p>
        </div>
        <div className={`${styles.panel} glass`}>
          <div className={styles.empty}>
            <span>◇</span>
            <p>No events scheduled</p>
          </div>
        </div>
      </div>
    </>
  );
}
