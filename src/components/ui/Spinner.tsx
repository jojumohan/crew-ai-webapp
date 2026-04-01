export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'w-4 h-4 border-2', md: 'w-7 h-7 border-2', lg: 'w-10 h-10 border-[3px]' }[size];
  return <div className={`${cls} rounded-full border-wa-muted border-t-wa-green animate-spin`} role="status" />;
}
