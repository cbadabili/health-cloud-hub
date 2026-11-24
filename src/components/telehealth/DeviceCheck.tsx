import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, Mic, Wifi, WifiOff, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DeviceState = "idle" | "checking" | "ok" | "blocked" | "missing" | "busy" | "unsupported" | "error";

const MESSAGES: Record<DeviceState, string> = {
  idle: "Not checked yet",
  checking: "Checking...",
  ok: "Working",
  blocked: "Blocked. Allow access in your browser's site settings, then check again.",
  missing: "Not found. Connect one and check again.",
  busy: "In use by another app. Close it and check again.",
  unsupported: "This browser can't use it. Try a recent Chrome, Edge, Safari or Firefox.",
  error: "Couldn't be checked. Please try again.",
};

/** Maps a getUserMedia error to a device state. */
const stateFromError = (error: unknown): DeviceState => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "blocked";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "missing";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "error";
};

const StatusRow = ({ icon: Icon, label, state }: { icon: typeof Camera; label: string; state: DeviceState }) => (
  <div className="flex items-start gap-3 rounded-lg border border-border p-3">
    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p
        className={`text-sm ${
          state === "ok"
            ? "text-green-700 dark:text-green-300"
            : state === "idle" || state === "checking"
              ? "text-muted-foreground"
              : "text-red-700 dark:text-red-300"
        }`}
      >
        {MESSAGES[state]}
      </p>
    </div>
    {state === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
    {state === "ok" && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />}
    {!["idle", "checking", "ok"].includes(state) && (
      <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
    )}
  </div>
);

/**
 * Real camera and microphone check: asks the browser for access, shows a live
 * preview and a microphone level, then releases the devices when stopped.
 */
const DeviceCheck = () => {
  const [camera, setCamera] = useState<DeviceState>("idle");
  const [microphone, setMicrophone] = useState<DeviceState>("idle");
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [level, setLevel] = useState(0);
  const [running, setRunning] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setLevel(0);
    setRunning(false);
  }, []);

  // Always release the camera and microphone when leaving the page.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const startLevelMeter = (stream: MediaStream) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(100, Math.round(Math.sqrt(sum / data.length) * 300)));
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
  };

  const check = async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unsupported");
      setMicrophone("unsupported");
      return;
    }
    setCamera("checking");
    setMicrophone("checking");

    let stream: MediaStream | null = null;
    try {
      // One request, so the browser shows a single permission prompt.
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCamera("ok");
      setMicrophone("ok");
    } catch {
      // Find out which device failed, keeping whichever one works.
      const tracks: MediaStreamTrack[] = [];
      for (const kind of ["video", "audio"] as const) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({ [kind]: true });
          tracks.push(...s.getTracks());
          (kind === "video" ? setCamera : setMicrophone)("ok");
        } catch (err) {
          (kind === "video" ? setCamera : setMicrophone)(stateFromError(err));
        }
      }
      stream = tracks.length ? new MediaStream(tracks) : null;
    }

    if (!stream) return;
    streamRef.current = stream;
    setRunning(true);
    if (stream.getVideoTracks().length && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
    if (stream.getAudioTracks().length) startLevelMeter(stream);
  };

  const checked = camera !== "idle" || microphone !== "idle";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Check your camera and microphone
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Your browser will ask for permission. Nothing is recorded or sent anywhere: the preview stays on this
          device.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
            <video
              ref={videoRef}
              muted
              playsInline
              aria-label="Camera preview"
              className={`h-full w-full object-cover -scale-x-100 ${running && camera === "ok" ? "" : "hidden"}`}
            />
            {!(running && camera === "ok") && (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-slate-300">
                {camera === "checking" ? "Starting camera..." : "Camera preview appears here"}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <StatusRow icon={Camera} label="Camera" state={camera} />
            <StatusRow icon={Mic} label="Microphone" state={microphone} />
            {running && microphone === "ok" && (
              <div className="space-y-1 px-1">
                <p className="text-xs text-muted-foreground">Speak to test: the bar should move.</p>
                <div
                  role="meter"
                  aria-label="Microphone level"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={level}
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full bg-medical-green transition-[width] duration-75" style={{ width: `${level}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {online ? (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">Internet</p>
                <p className={`text-sm ${online ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                  {online ? "Connected" : "Offline"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={check} disabled={camera === "checking"}>
            {checked ? "Check again" : "Check camera and microphone"}
          </Button>
          {running && (
            <Button variant="outline" onClick={stop}>
              Stop check
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceCheck;
