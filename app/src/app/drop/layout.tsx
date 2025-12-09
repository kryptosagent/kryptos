'use client';

import dynamic from 'next/dynamic';

const KryptosDropPrivyProvider = dynamic(
  () => import('@/providers/KryptosDropPrivyProvider').then(mod => mod.KryptosDropPrivyProvider),
  { ssr: false }
);

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
