'use client';

import { KryptosDropPrivyProvider } from '@/providers/KryptosDropPrivyProvider';

export default function DropLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <KryptosDropPrivyProvider>
      {children}
    </KryptosDropPrivyProvider>
  );
}
