"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import QRCode from "react-qr-code";
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  TextField,
} from "@mui/material";

/**
 * Desktop side:
 * 1) Generate sessionId, createOffer, setLocalDescription -> POST to /api/webrtc
 * 2) Poll for phone's answer. Once we see an answer, setRemoteDescription.
 * 3) On ICE candidate => POST to /api/webrtc with role=desktop
 * 4) Poll for phone's ICE candidates. Add them to our PC.
 * 5) When phone connects, stream arrives on remoteStream => show on videoRef
 */

export default function Desktop() {
  const [sessionId, setSessionId] = useState("");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [connected, setConnected] = useState(false);
  const [showConnectedAlert, setShowConnectedAlert] = useState(false);

  // For capturing
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [capturedImage, setCapturedImage] = useState("");

  // For uploading
  const [uploading, setUploading] = useState(false);
  const [responseText, setResponseText] = useState("");

  // Polling intervals
  const candidatesPollRef = useRef<NodeJS.Timer | null>(null);
  const answerPollRef = useRef<NodeJS.Timer | null>(null);

  useEffect(() => {
    const newPc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    // If the phone sends us a track, we display it in remote video
    newPc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Collect ICE candidates and send to server
    newPc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await fetch("/api/webrtc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              candidate: event.candidate.toJSON(),
              role: "desktop",
            }),
          });
        } catch (err) {
          console.error("Error sending desktop ICE candidate", err);
        }
      }
    };

    newPc.onconnectionstatechange = () => {
      if (
        newPc.connectionState === "connected" ||
        newPc.connectionState === "completed"
      ) {
        setConnected(true);
        setShowConnectedAlert(true);
        setTimeout(() => {
          setShowConnectedAlert(false);
        }, 5000);
      }
    };

    setPc(newPc);

    return () => {
      newPc.close();
      if (candidatesPollRef.current) clearInterval(candidatesPollRef.current);
      if (answerPollRef.current) clearInterval(answerPollRef.current);
    };
    // We intentionally don't list sessionId in deps so the PC doesn't get re-initialized
  }, []);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleGenerateSession = async () => {
    if (!pc) return;
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    setErrorMessage("");
    setConnected(false);

    try {
      // Create offer
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      // Send offer to server
      await fetch("/api/webrtc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: newSessionId,
          description: offer,
        }),
      });

      // Start polling for answer
      pollForAnswer(newSessionId, pc);

      // Start polling for phone's ICE candidates
      if (candidatesPollRef.current) {
        clearInterval(candidatesPollRef.current);
      }
      candidatesPollRef.current = setInterval(
        () => pollCandidates(newSessionId, pc, "phone"),
        2000
      );
    } catch (err) {
      console.error(err);
      setErrorMessage("Error creating or sending offer.");
    }
  };

  const pollForAnswer = (sId: string, pcRef: RTCPeerConnection) => {
    setLoading(true);
    let attempts = 0;
    const maxAttempts = 40;

    if (answerPollRef.current) clearInterval(answerPollRef.current);

    answerPollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setLoading(false);
        setErrorMessage("No answer received in time. Refresh and try again.");
        if (answerPollRef.current) clearInterval(answerPollRef.current);
        return;
      }
      try {
        const res = await fetch(`/api/webrtc?sessionId=${sId}`);
        const data = await res.json();
        if (data.answer) {
          // We got the phone's answer
          const remoteDesc = new RTCSessionDescription(data.answer);
          await pcRef.setRemoteDescription(remoteDesc);
          setLoading(false);
          if (answerPollRef.current) clearInterval(answerPollRef.current);
        }
      } catch (err) {
        console.error("Poll error:", err);
        setErrorMessage("Error polling for phone's answer.");
        setLoading(false);
        if (answerPollRef.current) clearInterval(answerPollRef.current);
      }
    }, 2000);
  };

  const pollCandidates = async (
    sId: string,
    pcRef: RTCPeerConnection,
    side: "phone" | "desktop"
  ) => {
    try {
      const res = await fetch(`/api/webrtc?sessionId=${sId}`);
      const data = await res.json();
      const candidatesKey =
        side === "phone" ? "candidatesPhone" : "candidatesDesktop";
      const candidates: RTCIceCandidateInit[] = data[candidatesKey] || [];
      for (const c of candidates) {
        try {
          await pcRef.addIceCandidate(new RTCIceCandidate(c));
        } catch (iceErr) {
          console.error("Error adding ICE candidate:", iceErr);
        }
      }
      // We could clear them from the server if we wanted, but for simplicity we keep them
      // In a production app, you might PATCH the server to clear or mark them as used
    } catch (err) {
      console.error("Poll candidate error:", err);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !remoteStream) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageUrl = canvas.toDataURL("image/png");
    setCapturedImage(imageUrl);
  };

  const handleUpload = async () => {
    if (!canvasRef.current) return;
    setUploading(true);
    setResponseText("");

    // Convert canvas to blob
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append("pic", blob, "capture.png");
      try {
        const response = await fetch(
          "https://hook.us2.make.com/qbiavde1hf7s8vb89iojifhk1h1nvfmb",
          {
            method: "POST",
            body: formData,
          }
        );
        const text = await response.text();
        setResponseText(text);
      } catch (error) {
        console.error(error);
        setResponseText("An error occurred while uploading.");
      }
      setUploading(false);
    }, "image/png");
  };

  return (
    <Container sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Desktop Page
      </Typography>

      {!connected && (
        <Box sx={{ mb: 2 }}>
          <Button variant="contained" onClick={handleGenerateSession}>
            Connect to phone
          </Button>
        </Box>
      )}

      {sessionId && !connected && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6">Session ID</Typography>
          <TextField
            fullWidth
            margin="dense"
            value={sessionId}
            inputProps={{ readOnly: true }}
          />
          <Typography variant="body2">
            Use your phone to scan this QR code (or open the link) to connect:
          </Typography>
          <Box mt={2} sx={{ textAlign: "center" }}>
            <QRCode
              value={
                typeof window !== "undefined"
                  ? `${
                      process.env.NODE_ENV === "development"
                        ? "https://192.168.1.39:3000"
                        : window.location.origin
                    }/webrtc/phone?sessionId=${sessionId}`
                  : ""
              }
            />
          </Box>
        </Paper>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {loading && <Alert severity="info">Waiting for phone’s answer...</Alert>}

      {showConnectedAlert && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Connection established! We are receiving the phone’s stream.
        </Alert>
      )}

      <Box mt={4} sx={{ display: remoteStream ? "block" : "none" }}>
        {/* live video, so no captions here */}
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={{ maxWidth: "100%", border: "1px solid #ccc" }}
        />
      </Box>

      {connected && (
        <>
          <Box mt={2}>
            <Button
              variant="contained"
              onClick={handleCapture}
              disabled={!remoteStream}
            >
              Capture Frame
            </Button>
          </Box>

          <canvas
            ref={canvasRef}
            style={{ display: "block", marginTop: "1rem", maxWidth: "100%" }}
          />

          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={!capturedImage || uploading}
            >
              {uploading ? "Uploading..." : "Upload Captured Image"}
            </Button>
          </Box>
        </>
      )}
      {responseText && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="body2">{responseText}</Typography>
        </Paper>
      )}
    </Container>
  );
}
