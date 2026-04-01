import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useAppStore } from '../store';
import { Camera, CameraOff } from 'lucide-react';

export function HandTracker() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setTargetScale = useAppStore((state) => state.setTargetScale);
  const setTargetPosition = useAppStore((state) => state.setTargetPosition);
  const requestRef = useRef<number>(0);

  useEffect(() => {
    let handLandmarker: HandLandmarker;
    let stream: MediaStream;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setIsTracking(true);
            detect();
          };
        }
      } catch (err: any) {
        console.error(err);
        setError("Failed to access camera or load model.");
      }
    };

    let lastVideoTime = -1;
    const detect = () => {
      if (videoRef.current && handLandmarker) {
        const startTimeMs = performance.now();
        if (videoRef.current.currentTime !== lastVideoTime) {
          lastVideoTime = videoRef.current.currentTime;
          const results = handLandmarker.detectForVideo(videoRef.current, startTimeMs);
          
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Calculate openness more robustly using 2D distances (ignore Z for stability)
            const wrist = landmarks[0];
            const middleMCP = landmarks[9];
            const middleTip = landmarks[12];
            const thumbTip = landmarks[4];
            const pinkyTip = landmarks[20];
            
            // Reference size: wrist to middle knuckle
            const palmSize = Math.max(0.001, Math.hypot(wrist.x - middleMCP.x, wrist.y - middleMCP.y));
            
            // How far is the middle finger extended?
            const extension = Math.hypot(wrist.x - middleTip.x, wrist.y - middleTip.y);
            // How wide is the hand spread? (thumb to pinky)
            const spread = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);
            
            const normalizedExtension = extension / palmSize; // ~1.0 closed, ~2.2 open
            const normalizedSpread = spread / palmSize;       // ~0.5 closed, ~2.5 open
            
            // Combine both metrics for a reliable "openness" score
            const openness = (normalizedExtension + normalizedSpread) / 2.0;
            
            // Map openness [1.0, 2.0] to scale [0.5, 5.0]
            // Closed fist is usually < 1.0, fully open is > 2.0
            let scale = ((openness - 1.0) / (2.0 - 1.0)) * 4.5 + 0.5;
            scale = Math.max(0.2, Math.min(scale, 5.0));
            
            // Calculate position
            // MediaPipe x is [0, 1] from left to right of the UNMIRRORED image.
            // Since we mirror the video visually, if the user moves their hand to the left,
            // it appears on the right of the unmirrored image (x > 0.5).
            // We want the Saturn to move left (negative X in 3D space).
            const targetX = -(middleMCP.x - 0.5) * 15.0;
            const targetY = -(middleMCP.y - 0.5) * 10.0;
            
            setTargetScale(scale);
            setTargetPosition([targetX, targetY]);
          } else {
            // No hand detected, return to default scale and center
            setTargetScale(1.0);
            setTargetPosition([0, 0]);
          }
        }
      }
      requestRef.current = requestAnimationFrame(detect);
    };

    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (handLandmarker) handLandmarker.close();
    };
  }, [setTargetScale]);

  const targetScale = useAppStore((state) => state.targetScale);

  return (
    <div className="absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div className="relative w-32 h-24 bg-black/50 rounded-lg overflow-hidden border border-white/20 backdrop-blur-sm">
        <video
          ref={videoRef}
          className="w-full h-full object-cover transform -scale-x-100"
          playsInline
          muted
        />
        {!isTracking && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-500/20 text-red-200 text-xs text-center p-2">
            {error}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-white/70 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
        {isTracking ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
        {isTracking ? `Tracking (Scale: ${targetScale.toFixed(1)})` : 'Initializing...'}
      </div>
    </div>
  );
}
