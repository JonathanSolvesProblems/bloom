import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Fraunces, Inter, Instrument_Serif, Geist_Mono } from 'next/font/google'
import './globals.css'

/**
 * Fraunces carries the voice. Its SOFT and WONK axes were built to undo the
 * evenness of a modern grotesque: wonky italics, softened terminals, optical
 * sizing that makes a headline look cut for its size rather than scaled to it.
 * The result reads as set by a person, which is the entire point, and it is the
 * fastest single change away from the default look every generated site shares.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
})
// Kept for dense UI only (labels, inputs, small print), where personality would
// cost legibility and nobody is reading for pleasure.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const instrument = Instrument_Serif({ weight: '400', style: 'italic', subsets: ['latin'], variable: '--font-instrument' })
// The ledger hand: dates, counts, money, tick marks.
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Bloom: the clients you are about to lose, before you lose them',
  description:
    'Nobody cancels, they just quietly stop coming. Bloom reads your booking history, works out who is slipping against their own rhythm, and writes each one a personal note in your voice. Upload a CSV from whatever you already use.',
}

// Matches the midnight page ground, so the mobile browser chrome does not flash a
// different colour around the app.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#151516' },
  ],
}

// Belt-and-suspenders for the first visit (no cookie yet): runs in <head> before
// first paint and applies the saved theme with no flash. Prefers the cookie (which
// the server also read), then localStorage, then the brand DEFAULT of dark. It no
// longer follows the OS setting, because midnight is the brand and light is a
// deliberate opt-in on the toggle.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var s=m?m[1]:localStorage.getItem('theme');var t=(s==='dark'||s==='light')?s:'dark';d.setAttribute('data-theme',t);d.style.colorScheme=t;try{localStorage.setItem('theme',t)}catch(e){}}catch(e){}})();`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render the theme on the server from the cookie the toggle sets, so a refresh
  // paints the right theme with zero dependence on client timing. This is what
  // makes the setting actually stick across reloads.
  const themeCookie = (await cookies()).get('theme')?.value
  const theme = themeCookie === 'dark' || themeCookie === 'light' ? themeCookie : undefined

  return (
    <html
      lang="en"
      data-theme={theme}
      style={theme ? { colorScheme: theme } : undefined}
      suppressHydrationWarning
      className={`h-full ${fraunces.variable} ${inter.variable} ${instrument.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  )
}
