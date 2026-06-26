import { useState, useEffect, useRef } from "react";

export const useFaceDetection = (isActive: boolean, videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [noFaceCount, setNoFaceCount] = useState(0);
  const [multiFaceCount, setMultiFaceCount] = useState(0);
  const [currentFaceCount, setCurrentFaceCount] = useState<number | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const [detector, setDetector] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only load if active and in browser environment
    if (!isActive || typeof window === "undefined") {
      return;
    }

    let active = true;

    const initDetector = async () => {
      setIsModelLoading(true);
      setModelError(null);
      try {
        // Dynamically import @mediapipe/tasks-vision to avoid Next.js SSR build crashes
        const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );

        if (!active) {
          return;
        }

        const detectorInstance = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
        });

        if (!active) {
          detectorInstance.close();
          return;
        }

        setDetector(detectorInstance);
        setIsModelLoading(false);
        console.log("MediaPipe Face Detector initialized successfully");
      } catch (err: any) {
        console.error("Failed to initialize MediaPipe Face Detector:", err);
        if (active) {
          setModelError(err.message || "Failed to load face detection model");
          setIsModelLoading(false);
        }
      }
    };

    initDetector();

    return () => {
      active = false;
    };
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (detector) {
        detector.close();
      }
    };
  }, [detector]);

  useEffect(() => {
    if (!isActive || !detector || !videoRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCurrentFaceCount(null);
      return;
    }

    const video = videoRef.current;

    const runDetection = () => {
      if (!detector || !video || video.paused || video.ended) {
        return;
      }

      try {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          const timestamp = performance.now();
          const result = detector.detectForVideo(video, timestamp);
          
          if (result?.detections) {
            let count = result.detections.length;
            
            // Check if looking away (head turned left/right)
            let isLookingAway = false;
            if (count === 1) {
              const detection = result.detections[0];
              const keypoints = detection.keypoints;
              
              if (keypoints && keypoints.length >= 6) {
                // BlazeFace keypoints:
                // 0: Right Eye, 1: Left Eye, 2: Nose Tip, 3: Mouth Center, 4: Right Ear, 5: Left Ear
                const rightEye = keypoints[0];
                const leftEye = keypoints[1];
                const noseTip = keypoints[2];
                const mouthCenter = keypoints[3];
                const rightEar = keypoints[4];
                const leftEar = keypoints[5];
                
                if (rightEye && leftEye && noseTip && mouthCenter && rightEar && leftEar) {
                  // Calculate horizontal distances
                  const noseToRightEye = Math.abs(noseTip.x - rightEye.x);
                  const noseToLeftEye = Math.abs(noseTip.x - leftEye.x);
                  const eyeAsymmetry = Math.abs(noseToRightEye - noseToLeftEye) / (noseToRightEye + noseToLeftEye || 0.001);
                  
                  const noseToRightEar = Math.abs(noseTip.x - rightEar.x);
                  const noseToLeftEar = Math.abs(noseTip.x - leftEar.x);
                  const earAsymmetry = Math.abs(noseToRightEar - noseToLeftEar) / (noseToRightEar + noseToLeftEar || 0.001);
                  
                  // Calculate vertical alignment metrics
                  const eyeY = (rightEye.y + leftEye.y) / 2;
                  const earY = (rightEar.y + leftEar.y) / 2;
                  const distEyeMouthY = mouthCenter.y - eyeY;
                  
                  const ratioEyeNose = (noseTip.y - eyeY) / (distEyeMouthY || 0.001);
                  const earEyeDiff = (earY - eyeY) / (distEyeMouthY || 0.001);
                  
                  console.log(`[Face Proct] Metrics - eyeAsymmetry: ${eyeAsymmetry.toFixed(3)}, earAsymmetry: ${earAsymmetry.toFixed(3)}, ratioEyeNose: ${ratioEyeNose.toFixed(3)}, earEyeDiff: ${earEyeDiff.toFixed(3)}`);
                  
                  // Check if looking away in any direction (yaw / pitch)
                  const isLookingLeftRight = eyeAsymmetry > 0.22 || earAsymmetry > 0.38;
                  const isLookingUp = ratioEyeNose < 0.28 || earEyeDiff > 0.35;
                  const isLookingDown = ratioEyeNose > 0.75 || earEyeDiff < -0.35;
                  
                  if (isLookingLeftRight || isLookingUp || isLookingDown) {
                    isLookingAway = true;
                    console.log(`[Face Proct] Looking away detected! (LeftRight: ${isLookingLeftRight}, Up: ${isLookingUp}, Down: ${isLookingDown})`);
                  }
                }
              }
            }
            
            if (isLookingAway) {
              console.log("[Face Proct] Face detected but looking away. Counting as 0 faces.");
              count = 0;
            }
            
            console.log(`[Face Proct] Detected faces: ${count}`);
            setCurrentFaceCount(count);
            if (count === 0) {
              setNoFaceCount((prev) => {
                console.log(`[Face Proct] No face detected or looking away! Incremented count to ${prev + 1}`);
                return prev + 1;
              });
            } else if (count > 1) {
              setMultiFaceCount((prev) => {
                console.log(`[Face Proct] Multiple faces detected! Incremented count to ${prev + 1}`);
                return prev + 1;
              });
            }
          } else {
            console.log("[Face Proct] No detections object returned.");
            setCurrentFaceCount(0);
          }
        } else {
          console.log("[Face Proct] Video not ready yet. readyState:", video.readyState);
        }
      } catch (err) {
        console.error("Error during face detection loop:", err);
      }
    };

    intervalRef.current = setInterval(runDetection, 2000); // Check every 2 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, detector, videoRef]);

  return { noFaceCount, multiFaceCount, isModelLoading, modelError, currentFaceCount };
};
