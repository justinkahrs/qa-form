import { NextRequest, NextResponse } from "next/server";

type SessionData = {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
};

const globalStore = global as unknown as {
  signalingStore?: Record<string, SessionData>;
};

if (!globalStore.signalingStore) {
  globalStore.signalingStore = {};
}

/**
 * POST /api/webrtc
 * {
 *    sessionId: string,
 *    description: RTCSessionDescriptionInit
 * }
 *
 * or GET /api/webrtc?sessionId=...
 *   => returns { offer, answer }
 *
 * or PATCH /api/webrtc
 * {
 *    sessionId: string,
 *    description: RTCSessionDescriptionInit
 * }
 *   => store answer
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { sessionId, description } = body as {
    sessionId: string;
    description: RTCSessionDescriptionInit;
  };

  if (!sessionId || !description) {
    return NextResponse.json(
      { error: "Missing sessionId or description." },
      { status: 400 }
    );
  }

  if (!globalStore.signalingStore[sessionId]) {
    globalStore.signalingStore[sessionId] = {};
  }

  // This is a naive approach: we treat the first POST as the Desktop's offer
  globalStore.signalingStore[sessionId].offer = description;

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId." },
      { status: 400 }
    );
  }

  const data = globalStore.signalingStore[sessionId];
  if (!data) {
    return NextResponse.json({ offer: null, answer: null });
  }

  return NextResponse.json({
    offer: data.offer || null,
    answer: data.answer || null,
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { sessionId, description } = body as {
    sessionId: string;
    description: RTCSessionDescriptionInit;
  };

  if (!sessionId || !description) {
    return NextResponse.json(
      { error: "Missing sessionId or description." },
      { status: 400 }
    );
  }

  if (!globalStore.signalingStore[sessionId]) {
    globalStore.signalingStore[sessionId] = {};
  }

  // This is a naive approach: we treat the PATCH as the phone's answer
  globalStore.signalingStore[sessionId].answer = description;

  return NextResponse.json({ success: true });
}