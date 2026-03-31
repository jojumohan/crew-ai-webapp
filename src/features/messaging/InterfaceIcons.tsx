import type { ReactNode } from 'react';

type IconProps = {
  className?: string;
};

function Svg({ className, children, viewBox = '0 0 24 24' }: IconProps & { children: ReactNode; viewBox?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox={viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

export function CommunityIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 18c.9-2.2 3-3.5 5.2-3.5S13 15.8 13.8 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14.3 17c.6-1.4 1.9-2.2 3.4-2.2 1.3 0 2.5.7 3.1 1.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function StatusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4a8 8 0 1 1-5.66 2.34" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </Svg>
  );
}

export function ChatBubbleIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4H16a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H11l-4.5 4v-4H7.5A2.5 2.5 0 0 1 5 12.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DotsIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </Svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="5.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 15.5 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function FilterIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 4a4 4 0 0 0-4 4v2.5c0 .7-.2 1.3-.6 1.8L6 14h12l-1.4-1.7c-.4-.5-.6-1.1-.6-1.8V8a4 4 0 0 0-4-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 17a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function VideoIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="m14 10 5-2.5v9L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M7.6 5.5c.6-.6 1.6-.5 2 .2l1.3 2.2c.3.5.2 1.1-.2 1.5l-1 1c.8 1.5 2 2.7 3.5 3.5l1-1c.4-.4 1-.5 1.5-.2l2.2 1.3c.7.4.8 1.4.2 2l-1 1c-.8.8-2 1.1-3.1.8-2.5-.7-4.7-2.1-6.4-3.8-1.7-1.7-3.1-3.9-3.8-6.4-.3-1.1 0-2.3.8-3.1l1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function SmileyIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 14c.7 1 1.8 1.5 3 1.5s2.3-.5 3-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9.2" cy="10.2" r="1" fill="currentColor" />
      <circle cx="14.8" cy="10.2" r="1" fill="currentColor" />
    </Svg>
  );
}

export function ClipIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M9.5 12.5 15 7a2.5 2.5 0 1 1 3.5 3.5l-7 7a4 4 0 0 1-5.7-5.7l7.2-7.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 11.5 19 5l-3.7 14-3.5-5-7.8-2.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m11.8 14 2.8-2.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function BackIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="6" y="10" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 10V8a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
