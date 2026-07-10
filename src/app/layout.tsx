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

// Runs in <head>, before first paint, so the saved theme applies with no flash.
// <html> is marked suppressHydrationWarning because this script mutates it
// before React hydrates; without that, React reconciles the attribute away and
// the page snaps back to light on every refresh.
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var d=document.documentElement;d.setAttribute('data-theme',t);d.style.colorScheme=t;}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`h-full ${bricolage.variable} ${inter.variable} ${instrument.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  )
}
