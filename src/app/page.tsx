import styles from './page.module.css';

const stack = [
  {
    title: 'Frontend',
    detail: 'Next.js 16, React 19, TypeScript, responsive messaging UI',
  },
  {
    title: 'Real-time',
    detail: 'Socket.IO with Redis fan-out for presence, typing, and delivery',
  },
  {
    title: 'Data',
    detail: 'PostgreSQL for durable chat state, Redis for ephemeral state, S3 for media',
  },
  {
    title: 'Calls',
    detail: 'WebRTC with LiveKit SFU for stable voice and video calling',
  },
];

const phases = [
  'Phase 1: Auth, 1-on-1 chat, media uploads, message history',
  'Phase 2: Group chats, typing, read receipts, last seen',
  'Phase 3: Voice/video calls, push notifications, multi-device hardening',
];

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>2026 rebuild direction</p>
          <h1>We are rebuilding this app into a chat-first messaging platform.</h1>
          <p className={styles.subtitle}>
            The old team dashboard is being replaced with a WhatsApp-style web experience
            centered on private messaging, groups, fast media delivery, and reliable calls.
          </p>
          <div className={styles.actions}>
            <a href="/login" className={styles.primaryCta}>
              Open current auth
            </a>
            <a href="#roadmap" className={styles.secondaryCta}>
              View roadmap
            </a>
          </div>
        </div>

        <div className={styles.previewCard}>
          <div className={styles.previewShell}>
            <aside className={styles.sidebarPreview}>
              <div className={styles.sidebarHeader}>Chats</div>
              <div className={styles.chatItemActive}>
                <span className={styles.avatar}>A</span>
                <div>
                  <strong>Aron</strong>
                  <p>Typing a rebuild note...</p>
                </div>
              </div>
              <div className={styles.chatItem}>
                <span className={styles.avatarMuted}>D</span>
                <div>
                  <strong>Design Team</strong>
                  <p>3 unread messages</p>
                </div>
              </div>
              <div className={styles.chatItem}>
                <span className={styles.avatarMuted}>C</span>
                <div>
                  <strong>Client Ops</strong>
                  <p>Last seen 2m ago</p>
                </div>
              </div>
            </aside>

            <div className={styles.chatPreview}>
              <div className={styles.chatHeader}>
                <div>
                  <strong>Aron</strong>
                  <p>online now</p>
                </div>
                <span className={styles.callBadge}>voice + video ready</span>
              </div>

              <div className={styles.messageColumn}>
                <div className={styles.messageIncoming}>
                  Let&apos;s rebuild this properly: fast chat first, calls after.
                </div>
                <div className={styles.messageOutgoing}>
                  Agreed. We keep the env and infra, replace the product surface.
                </div>
                <div className={styles.messageIncoming}>
                  Phase 1 ships private chat, uploads, and presence.
                </div>
              </div>

              <div className={styles.composer}>
                <span>Message</span>
                <div className={styles.sendButton}>Send</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.stackSection}>
        {stack.map((item) => (
          <article key={item.title} className={styles.stackCard}>
            <p className={styles.stackLabel}>{item.title}</p>
            <h2>{item.title} layer</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className={styles.blueprintSection}>
        <div className={styles.blueprintIntro}>
          <p className={styles.kicker}>Architecture blueprint</p>
          <h2>Recommended platform decisions for the rebuild</h2>
          <p>
            Use PostgreSQL as the source of truth, Redis for ephemeral presence and
            socket coordination, and LiveKit for production-grade calling instead of a
            fragile peer mesh.
          </p>
        </div>

        <div className={styles.blueprintGrid}>
          <article className={styles.blueprintCard}>
            <h3>Real-time engine</h3>
            <p>
              Socket.IO rooms plus Redis adapter for presence, typing, delivery
              acknowledgements, and reconnect-safe event fan-out.
            </p>
          </article>
          <article className={styles.blueprintCard}>
            <h3>Security</h3>
            <p>
              Device-bound sessions, rotating refresh tokens, Argon2id, and a clean
              path to Signal-style end-to-end encryption.
            </p>
          </article>
          <article className={styles.blueprintCard}>
            <h3>Database model</h3>
            <p>
              Users, devices, conversations, members, messages, attachments,
              receipts, and calls with cursor-based message history.
            </p>
          </article>
          <article className={styles.blueprintCard}>
            <h3>Media and calls</h3>
            <p>
              Signed uploads to object storage, background processing in workers, and
              WebRTC over an SFU for reliable voice and video.
            </p>
          </article>
        </div>
      </section>

      <section id="roadmap" className={styles.roadmapSection}>
        <div className={styles.roadmapHeader}>
          <p className={styles.kicker}>Feature roadmap</p>
          <h2>Build order for the new application</h2>
        </div>

        <div className={styles.phaseList}>
          {phases.map((phase) => (
            <article key={phase} className={styles.phaseCard}>
              {phase}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
