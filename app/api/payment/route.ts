import { NextResponse } from 'next/server'

import { YooCheckout } from '@a2seven/yoo-checkout'



export async function POST(req: Request) {

  try {

    const shopId = process.env.YOOKASSA_SHOP_ID

    const secretKey = process.env.YOOKASSA_SECRET_KEY



    console.log("ENV SHOP:", shopId)

    console.log("ENV SECRET:", secretKey)



    if (!shopId || !secretKey) {

      return NextResponse.json(

        { error: 'Missing YooKassa credentials' },

        { status: 500 }

      )

    }



    const checkout = new YooCheckout({

      shopId,

      secretKey,

    })



    const body = await req.json()

    const { amount, userId } = body



    if (!amount || !userId) {

      return NextResponse.json(

        { error: 'Missing amount or userId' },

        { status: 400 }

      )

    }



    const payment = await checkout.createPayment(

      {

        amount: {

          value: Number(amount).toFixed(2),

          currency: 'RUB',

        },

        confirmation: {

          type: 'redirect',

          return_url: 'https://vitaklim.vercel.app/profile',

        },

        capture: true,

        description: `Пополнение баланса пользователем ${userId}`,

        metadata: {

          userId,

        },

      },

      Math.random().toString(36).substring(2, 15)

    )



    return NextResponse.json({

      confirmationUrl: payment.confirmation?.confirmation_url,

    })

  } catch (error: any) {

    console.error('YooKassa FULL error:', error?.response?.data || error)



    return NextResponse.json(

      { error: error?.response?.data || 'Payment creation failed' },

      { status: 500 }

    )

  }

}