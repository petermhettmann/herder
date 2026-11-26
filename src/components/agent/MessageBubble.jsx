import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const isFailed = (toolCall) => {
  const status = String(toolCall?.status ?? "").toLowerCase();
  return ["failed", "error"].includes(status);
};

function ToolLine({ toolCall }) {
  const projection = toolCall?.display_projection;
  const hide = projection?.hide_details && projection?.details_redacted;
  const failed = isFailed(toolCall);
  const label = failed
    ? projection?.error_label ?? "Failed"
    : hide
      ? projection?.label ?? "Done"
      : toolCall?.name ?? "Tool";

  return (
    <p className="tnum mt-1.5 text-[11px] text-muted-foreground">
      {label}
      {!hide && !failed && <span className="text-muted-foreground/70"> · {toolCall?.status ?? "running"}</span>}
    </p>
  );
}

export default function MessageBubble({ message }) {
  const isUser = message?.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5",
          isUser ? "bg-secondary text-foreground" : "border border-border",
        )}
      >
        {message?.content && (
          isUser ? (
            <p className="whitespace-pre-wrap text-[13px] leading-[1.5]">{message.content}</p>
          ) : (
            <div className="space-y-1.5 text-[13px] leading-[1.5] [&_p]:m-0">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )
        )}
        {message?.tool_calls?.map((toolCall, index) => (
          <ToolLine key={`${toolCall?.name ?? "tool"}-${index}`} toolCall={toolCall} />
        ))}
      </div>
    </div>
  );
}