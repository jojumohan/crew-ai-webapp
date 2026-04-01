type Status = 'SENT' | 'DELIVERED' | 'READ';
export default function StatusIcon({ status }: { status: Status }) {
  if (status === 'SENT') return <svg viewBox="0 0 16 11" className="w-4 h-3 fill-wa-muted inline-block ml-1 flex-shrink-0"><path d="M11.071.653L4.42 7.302 1.577 4.46.5 5.538l3.92 3.92 7.728-7.728z"/></svg>;
  const cls = status === 'READ' ? 'fill-wa-blue' : 'fill-wa-muted';
  return <svg viewBox="0 0 18 11" className={`w-4 h-3 ${cls} inline-block ml-1 flex-shrink-0`}><path d="M17.394.653l-6.65 6.649-1.072-1.072L17.394.653zM1.577 4.46L4.42 7.302l7.651-7.649 1.076 1.073L4.42 9.46.5 5.538 1.577 4.46zm5.844 5.844L9.344 12.226l7.651-7.649 1.076 1.073-8.727 8.727-3.92-3.92 1.077-1.153z" transform="scale(.83)"/></svg>;
}
