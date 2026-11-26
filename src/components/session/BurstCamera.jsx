import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BurstCamera({ camera, label = "Take 3 shots, 1s apart" }) {
  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-secondary">
        <video ref={camera.videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
        {!camera.ready && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
            {camera.error || "Starting camera..."}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {camera.slots.map((slot, index) => (
          <div key={index} className="relative overflow-hidden rounded-lg border border-border bg-secondary">
            {slot ? (
              <>
                <img src={slot.url} alt={`Shot ${index + 1}`} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  onClick={() => camera.retake(index)}
                  className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/85 py-1 text-[11px] text-foreground"
                >
                  <RotateCcw className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Retake
                </button>
              </>
            ) : (
              <div className="tnum flex aspect-square items-center justify-center text-[11px] text-muted-foreground">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={camera.fireBurst}
        disabled={!camera.ready || camera.firing}
        className="mt-3 h-11 w-full rounded-xl text-[12px]"
      >
        <Camera className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        {camera.firing ? "Firing..." : label}
      </Button>
    </div>
  );
}