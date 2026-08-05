import type { Metadata } from 'next'
import { Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/shared/ThemeProvider'

// Be Vietnam Pro — designed for full Vietnamese diacritic coverage (the
// previous Inter setup only loaded the `latin` subset, missing that).
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export const metadata: Metadata = {
  title: 'Green STEM Compass',
  description: 'La Bàn Định Vị Năng Lực STEM — Next Level 5',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={beVietnamPro.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
