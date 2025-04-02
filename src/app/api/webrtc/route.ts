import { NextRequest, NextResponse } from "next/server";

type SessionData = {
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidatesDesktop?: RTCIceCandidateInit[];
  candidatesPhone?: RTCIceCandidateInit[];
};

const globalStore = global as unknown as {
  signalingStore?: Record<string, SessionData>;
};

if (!globalStore.signalingStore) {
  globalStore.signalingStore = {};
}

/**
 * We'll handle everything in a single route:
 * - POST /api/webrtc (JSON body)
 * - PATCH /api/webrtc (JSON body)
 * - GET /api/webrtc?sessionId=...
 *
 * We will also accept ICE candidates via POST. We'll rely on an extra field "candidate" in the body, plus "role" = "desktop" or "phone".
 * We store them in memory so each side can poll them with a GET request.
 */

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { sessionId, description, candidate, role } = body;

  // If we're getting an offer from the Desktop
  if (sessionId && description && !candidate) {
    if (!globalStore.signalingStore[sessionId]) {
      globalStore.signalingStore[sessionId] = {};
    }
    // This is the Desktop's offer
    globalStore.signalingStore[sessionId].offer = description;
    return NextResponse.json({ success: true });
  }

  // If we're getting a candidate from either Desktop or Phone
  if (sessionId && candidate && role) {
    if (!globalStore.signalingStore[sessionId]) {
      globalStore.signalingStore[sessionId] = {};
    }

    const store = globalStore.signalingStore[sessionId];
    if (role === "desktop") {
      if (!store.candidatesDesktop) {
        store.candidatesDesktop = [];
      }
      store.candidatesDesktop.push(candidate);
    } else if (role === "phone") {
      if (!store.candidatesPhone) {
        store.candidatesPhone = [];
      }
      store.candidatesPhone.push(candidate);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { error: "Invalid POST payload. Provide 'sessionId' and either 'description' or 'candidate+role'." },
    { status: 400 }
  );
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
    return NextResponse.json({
      offer: null,
      answer: null,
      candidatesDesktop: [],
      candidatesPhone: []
    });
  }

  return NextResponse.json({
    offer: data.offer || null,
    answer: data.answer || null,
    candidatesDesktop: data.candidatesDesktop || [],
    candidatesPhone: data.candidatesPhone || []
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

  // We treat the PATCH as the Phone's answer
  globalStore.signalingStore[sessionId].answer = description;

  return NextResponse.json({ success: true });
}