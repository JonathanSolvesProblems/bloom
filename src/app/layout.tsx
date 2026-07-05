import type { Metadata } from 'next'
import { Bricolage_Grotesque, Inter, Instrument_Serif, Geist_Mono } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const instrument = Instrument_Serif({ weight: '400', style: 'italic', subsets: ['latin'], variable: '--font-instrument' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Bloom: AI Marketing for Local Businesses',
  description:
    'Bloom is an AI marketing agent for local businesses. It writes your weekly newsletter and social posts, emails the newsletter to your subscribers automatically, and hands you ready-to-paste captions.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full ${bricolage.variable} ${inter.variable} ${instrument.variable} ${geistMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  )
}
