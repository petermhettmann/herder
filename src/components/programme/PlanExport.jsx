import { useState } from "react";
import { Button } from "@/components/ui/button";
import { serializePlan } from "@/lib/plan-text";

export default function PlanExport({ programme, nights }) {
  const [copied, setCopied] = useState(false);
  const text = serializePlan(programme, nights);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = String(programme?.name ?? "plan")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    link.href = url;
    link.download = `${slug || "plan"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={copy}
        className="h-12 rounded-xl text-[13px]"
      >
        {copied ? "Copied" : "Copy plan"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={download}
        className="h-12 rounded-xl text-[13px]"
      >
        Download .txt
      </Button>
    </div>
  );
}