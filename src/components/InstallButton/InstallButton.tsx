'use client';

import { useEffect, useState } from 'react';
import styles from './InstallButton.module.css';

export default function InstallButton() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed || !prompt) return null;

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return (
    <button className={styles.btn} onClick={install} title="Install Aronlabz Teams">
      <span className={styles.icon}>📲</span>
      <span className={styles.label}>Install App</span>
    </button>
  );
}
