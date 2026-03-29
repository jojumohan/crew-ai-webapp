import Header from '@/components/Header/Header';
import AgentPanel from './AgentPanel';
import styles from '../page.module.css';

export default function AgentsPage() {
  return (
    <>
      <Header title="AI Agents" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>AI Agents</h1>
          <p>Monitor and control your Aronlabz AI Chief of Staff.</p>
        </div>
        <AgentPanel />
      </div>
    </>
  );
}
