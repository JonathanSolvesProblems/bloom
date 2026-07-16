import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Bricolage_Grotesque, Inter, Instrument_Serif, Geist_Mono } from 'next/font/google'
import './globals.css'

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const instrument = Instrument_Serif({ weight: '400', style: 'italic', subsets: ['latin'], variable: '--font-instrument' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Bloom: the clients you are about to lose, before you lose them',
  description:
    'Nobody cancels, they just quietly stop coming. Bloom reads your booking history, works out who is slipping against their own rhythm, and writes each one a personal note in your voice. Upload a CSV from whatever you already use.',
}

// Belt-and-suspenders for the first visit (no cookie yet): runs in <head> before
// first paint and applies the saved theme with no flash. The toggle writes both a
// cookie and localStorage, so this prefers the cookie (which the server also
// read), then localStorage, then the OS setting, and keeps all three in sync.
const THEME_SCRIPT = `(function(){try{var d=document.documentElement;var m=document.cookie.match(/(?:^|; )theme=(dark|light)/);var s=m?m[1]:localStorage.getItem('theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');d.setAttribute('data-theme',t);d.style.colorScheme=t;try{localStorage.setItem('theme',t)}catch(e){}}catch(e){}})();`

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
      className={`h-full ${bricolage.variable} ${inter.variable} ${instrument.variable} ${geistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  )
}
