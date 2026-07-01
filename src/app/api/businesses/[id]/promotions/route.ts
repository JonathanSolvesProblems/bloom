import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.formData()
  const promotions = body.get('promotions')?.toString() ?? ''

  await db.business.update({
    where: { id },
    data: { promotions },
  })

  const { redirect } = await import('next/navigation')
  redirect(`/dashboard/${id}`)
}
