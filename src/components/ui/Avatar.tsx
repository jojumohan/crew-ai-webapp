interface AvatarProps { name?: string | null; src?: string | null; size?: 'sm' | 'md' | 'lg'; isOnline?: boolean; }
const SIZES = { sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base', lg: 'w-14 h-14 text-xl' };
function nameColor(name: string) { const colors = ['bg-red-600','bg-orange-600','bg-amber-600','bg-green-600','bg-teal-600','bg-cyan-600','bg-blue-600','bg-violet-600']; let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length; return colors[h]; }
export default function Avatar({ name, src, size = 'md', isOnline }: AvatarProps) {
  return (
    <div className="relative flex-shrink-0">
      <div className={`${SIZES[size]} rounded-full flex items-center justify-center overflow-hidden ${src ? '' : nameColor(name ?? '')}`}>
        {src ? <img src={src} alt={name ?? ''} className="w-full h-full object-cover" /> : <span className="font-semibold text-white">{(name ?? '?').trim().charAt(0).toUpperCase()}</span>}
      </div>
      {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-wa-panel rounded-full" />}
    </div>
  );
}
