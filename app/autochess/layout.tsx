import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CHESS_NAME } from '@/lib/meta/chess-brand';

export const metadata: Metadata = {
  title: CHESS_NAME,
  applicationName: CHESS_NAME,
  appleWebApp: { title: CHESS_NAME },
  openGraph: { title: CHESS_NAME, siteName: CHESS_NAME },
  description: '与人同席，与机对弈。挑选棋子、搭配阵容，开启一局自走棋。',
};

export default function AutochessLayout({ children }: { children: ReactNode }) {
  return children;
}
