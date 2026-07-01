import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bloom — AI Marketing for Local Businesses',
  description:
    'Your AI marketing team. Bloom writes and sends weekly posts, newsletters, and updates for your local business — automatically.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-white text-gray-900">{children}</body>
    </html>
  )
}
