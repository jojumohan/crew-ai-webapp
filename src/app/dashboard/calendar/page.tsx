import Header from '@/components/Header/Header';
import CalendarView from './CalendarView';
import styles from '../page.module.css';

export default function CalendarPage() {
  return (
    <>
      <Header title="Calendar" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Calendar</h1>
          <p>Upcoming events from Aronlabz Google Calendar.</p>
        </div>
        <CalendarView />
      </div>
    </>
  );
}
