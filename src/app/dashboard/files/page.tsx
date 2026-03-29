import Header from '@/components/Header/Header';
import styles from '../page.module.css';

export default function FilesPage() {
  return (
    <>
      <Header title="Files" />
      <div className={styles.page}>
        <div className={styles.welcome}>
          <h1>Files</h1>
          <p>Shared files and documents.</p>
        </div>
        <div className={`${styles.panel} glass`}>
          <div className={styles.empty}>
            <span>▣</span>
            <p>No files uploaded</p>
          </div>
        </div>
      </div>
    </>
  );
}
