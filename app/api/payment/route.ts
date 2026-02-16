import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, userId } = body

    if (!amount || !userId) {
      return NextResponse.json(
        { error: 'Missing amount or userId' },
        { status: 400 }
      )
    }

    console.log('Создание платежа:', {
      userId,
      amount,
    })

    // Пока просто возвращаем заглушку
    return NextResponse.json({
      success: true,
      message: 'Payment endpoint works',
      amount,
      userId,
    })
  } catch (error) {
    console.error('Payment error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
