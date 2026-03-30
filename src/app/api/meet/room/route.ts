import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roomName } = await req.json();
    const apiKey = process.env.DAILY_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Daily.co API key not found in environment." }, { status: 500 });
    }

    // 1. Try to create the room
    const res = await fetch(`https://api.daily.co/v1/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: { exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) }, // Room expires in 24 hours
      }),
    });

    const data = await res.json();

    if (res.ok) {
      return NextResponse.json({ url: data.url });
    } 
    
    // 2. If it already exists, fetch the existing room's url
    if (data.info && data.info.includes('already exists')) {
       const getRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
         headers: { Authorization: `Bearer ${apiKey}` }
       });
       if (getRes.ok) {
         const getData = await getRes.json();
         return NextResponse.json({ url: getData.url });
       }
    }

    return NextResponse.json({ error: "Could not create or fetch Daily.co room." }, { status: 500 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
