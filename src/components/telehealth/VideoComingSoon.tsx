import { Video } from "lucide-react";

interface VideoComingSoonProps {
  /** Who is reading: changes the "what happens instead" sentence. */
  audience: "patient" | "doctor";
}

/** Honest notice shown until a video provider is integrated. */
const VideoComingSoon = ({ audience }: VideoComingSoonProps) => (
  <div
    role="note"
    className="flex gap-3 rounded-lg border border-medical-blue/30 bg-medical-light-blue p-4 text-sm text-foreground"
  >
    <Video className="h-5 w-5 shrink-0 text-medical-blue" />
    <div className="space-y-1">
      <p className="font-semibold">Video consultations are coming soon</p>
      <p className="text-muted-foreground">
        {audience === "patient"
          ? "You can't join a video call in Clinithetics yet. If you have a telehealth appointment, your practice will tell you how the consultation will take place."
          : "Video calls can't be started in Clinithetics yet. Please arrange how you'll consult with your telehealth patients directly until video is available."}{" "}
        In the meantime, you can check that your camera and microphone work below.
      </p>
    </div>
  </div>
);

export default VideoComingSoon;
