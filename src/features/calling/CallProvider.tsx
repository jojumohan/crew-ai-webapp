'use client';

import { ReactNode } from 'react';
import IncomingGroupCall from './IncomingGroupCall';

interface CallProviderProps {
  children: ReactNode;
}

export default function CallProvider({ children }: CallProviderProps) {
  return (
    <>
      {children}
      <IncomingGroupCall />
    </>
  );
}
