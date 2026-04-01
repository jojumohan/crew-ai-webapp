import { Message } from '@/store/chatStore';
import StatusIcon from '@/components/ui/StatusIcon';

function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

export default function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  if ((message as Message & { isDeleted?: boolean }).isDeleted) return <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}><div className="px-3 py-2 rounded-lg text-wa-muted text-sm italic bg-wa-hover max-w-xs">This message was deleted</div></div>;
  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1 px-4`}>
      <div className={`relative max-w-[70%] min-w-[80px] rounded-2xl px-3 py-2 shadow-sm ${isMine ? 'bg-wa-sent rounded-br-none bubble-sent' : 'bg-wa-panel rounded-bl-none bubble-received'}`}>
        {message.attachments?.map((att) => att.mimeType.startsWith('image/') ? (
          <img key={att.id} src={att.url} alt={att.filename} className="rounded-lg max-w-full mb-1" style={{ maxHeight: 300 }} />
        ) : (
          <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-wa-hover rounded-lg p-2 mb-1 text-sm text-wa-green hover:underline">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>{att.filename}
          </a>
        ))}
        {message.content && <p className="text-[15px] text-wa-text leading-snug whitespace-pre-wrap break-words">{message.content}</p>}
        <div className="flex items-center justify-end gap-0.5 mt-1">
          <span className="text-[11px] text-wa-muted">{formatTime(message.createdAt)}</span>
          {isMine && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}
