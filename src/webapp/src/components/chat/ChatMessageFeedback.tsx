import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Textarea } from "@/shadcn/components/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shadcn/components/popover";
import { cn } from "@/shadcn/lib/utils";
import type { FeedbackSentiment } from "@/apis/assistant";
import type { ChatMessageFeedback as FeedbackState } from "@/hooks/use-chat";

interface ChatMessageFeedbackProps {
  messageId: string;
  feedback?: FeedbackState;
  onSubmit: (
    messageId: string,
    sentiment: FeedbackSentiment,
    reason?: string
  ) => Promise<void>;
}

export function ChatMessageFeedback({
  messageId,
  feedback,
  onSubmit,
}: ChatMessageFeedbackProps) {
  const [pendingSentiment, setPendingSentiment] =
    useState<FeedbackSentiment | null>(null);
  const [reason, setReason] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSentiment = feedback?.sentiment ?? null;
  const isSubmitted = currentSentiment !== null;

  const handleThumbClick = (sentiment: FeedbackSentiment) => {
    if (isSubmitted) return;
    setPendingSentiment(sentiment);
    setIsOpen(true);
  };

  const handleSubmit = async (withReason: boolean) => {
    if (!pendingSentiment) return;
    setIsSubmitting(true);
    try {
      await onSubmit(
        messageId,
        pendingSentiment,
        withReason && reason.trim() ? reason.trim() : undefined
      );
    } finally {
      setIsSubmitting(false);
      setIsOpen(false);
      setReason("");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <span className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                isSubmitted && currentSentiment !== "like" && "opacity-30",
                currentSentiment === "like" && "text-green-600",
                !isSubmitted &&
                  "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
              disabled={isSubmitted}
              onClick={() => handleThumbClick("like")}
            >
              <ThumbsUp
                className={cn(
                  "h-3.5 w-3.5",
                  currentSentiment === "like" && "fill-current"
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7",
                isSubmitted && currentSentiment !== "dislike" && "opacity-30",
                currentSentiment === "dislike" && "text-red-600",
                !isSubmitted &&
                  "opacity-0 group-hover:opacity-100 transition-opacity"
              )}
              disabled={isSubmitted}
              onClick={() => handleThumbClick("dislike")}
            >
              <ThumbsDown
                className={cn(
                  "h-3.5 w-3.5",
                  currentSentiment === "dislike" && "fill-current"
                )}
              />
            </Button>
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {pendingSentiment === "like"
                ? "What did you like?"
                : "What could be improved?"}
            </p>
            <Textarea
              placeholder="Tell us more (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              maxLength={2000}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleSubmit(false)}
                disabled={isSubmitting}
              >
                Skip
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSubmit(true)}
                disabled={isSubmitting}
              >
                Submit
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
