'use client';

import { useEffect, useState } from 'react';
import styles from './team.module.css';

type Member = {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  role: 'admin' | 'staff';
  status: 'active' | 'pending';
  created_at: string;
};

export default function TeamManager({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ username: '', display_name: '', email: '', password: '', role: 'staff' });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/team');
    const data = await res.json();
    setMembers(data.users || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const active  = members.filter(m => m.status === 'active');
  const pending = members.filter(m => m.status === 'pending');

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.ok) {
      setMsg('Member added!');
      setForm({ username: '', display_name: '', email: '', password: '', role: 'staff' });
      setShowForm(false);
      load();
    } else {
      setMsg(data.error || 'Failed');
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 4000);
  }

  async function removeMember(id: number, name: string) {
    if (!confirm(`Remove ${name} from the team?`)) return;
    const res = await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.ok) load();
    else setMsg(data.error || 'Failed');
  }

  async function approve(id: number, action: 'approve' | 'reject', name: string) {
    if (action === 'reject' && !confirm(`Reject ${name}'s request?`)) return;
    const res = await fetch('/api/team/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();
    if (data.ok) { setMsg(action === 'approve' ? `${name} approved!` : `${name} rejected.`); load(); }
    else setMsg(data.error || 'Failed');
    setTimeout(() => setMsg(''), 3000);
  }

  return (
    <div className={styles.wrap}>

      {/* Pending approvals */}
      {isAdmin && pending.length > 0 && (
        <div className={styles.pendingSection}>
          <div className={styles.pendingTitle}>⏳ Pending Approval ({pending.length})</div>
          {pending.map(m => (
            <div key={m.id} className={`${styles.card} ${styles.pendingCard} glass`}>
              <div className={styles.avatar} style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>
                {(m.display_name || m.username).slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{m.display_name || m.username}</div>
                <div className={styles.meta}>@{m.username}{m.email ? ` · ${m.email}` : ''}</div>
              </div>
              <div className={styles.approvalBtns}>
                <button className={styles.btnApprove} onClick={() => approve(m.id, 'approve', m.display_name || m.username)}>✓ Approve</button>
                <button className={styles.btnReject}  onClick={() => approve(m.id, 'reject',  m.display_name || m.username)}>✕ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.topBar}>
        <span className={styles.count}>{active.length} active member{active.length !== 1 ? 's' : ''}</span>
        {isAdmin && (
          <button className={styles.btnAdd} onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ Add Member'}
          </button>
        )}
      </div>

      {msg && <div className={styles.msg}>{msg}</div>}

      {showForm && isAdmin && (
        <form className={`${styles.form} glass`} onSubmit={addMember}>
          <h3>New Team Member</h3>
          <div className={styles.fields}>
            <div className={styles.field}>
              <label>Username *</label>
              <input required value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. arun" />
            </div>
            <div className={styles.field}>
              <label>Display Name</label>
              <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Arun Kumar" />
            </div>
            <div className={styles.field}>
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="arun@example.com" />
            </div>
            <div className={styles.field}>
              <label>Password *</label>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div className={styles.field}>
              <label>Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <button type="submit" className={styles.btnSave} disabled={saving}>
            {saving ? 'Adding…' : 'Add Member'}
          </button>
        </form>
      )}

      {loading ? (
        <div className={styles.state}>Loading…</div>
      ) : (
        <div className={styles.list}>
          {active.map(m => (
            <div key={m.id} className={`${styles.card} glass`}>
              <div className={styles.avatar}>
                {(m.display_name || m.username).slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{m.display_name || m.username}</div>
                <div className={styles.meta}>@{m.username}{m.email ? ` · ${m.email}` : ''}</div>
              </div>
              <span className={`${styles.role} ${m.role === 'admin' ? styles.admin : styles.staff}`}>
                {m.role}
              </span>
              {isAdmin && m.role !== 'admin' && (
                <button className={styles.btnRemove} onClick={() => removeMember(m.id, m.display_name || m.username)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
