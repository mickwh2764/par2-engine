import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquarePlus, X, Send, Loader2, CheckCircle2 } from "lucide-react";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"suggestion" | "bug" | "other">("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          email: email.trim() || null,
          page: window.location.pathname,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit");
      }
      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setMessage("");
        setEmail("");
        setType("suggestion");
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 rounded-full h-12 w-12 p-0 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg"
        data-testid="button-open-feedback"
      >
        <MessageSquarePlus size={20} className="text-white" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80" data-testid="card-feedback-widget">
      <Card className="bg-white border border-slate-200 shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-slate-800 flex items-center gap-2">
              <MessageSquarePlus size={16} className="text-cyan-600" />
              Send Feedback
            </CardTitle>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-700 transition-colors"
              data-testid="button-close-feedback"
            >
              <X size={16} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-4" data-testid="text-feedback-success">
              <CheckCircle2 size={32} className="text-green-600" />
              <p className="text-sm text-green-700 font-medium">Thank you for your feedback!</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1.5">
                {(["suggestion", "bug", "other"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      type === t
                        ? t === "bug"
                          ? "bg-red-100 text-red-700 border border-red-300"
                          : t === "suggestion"
                          ? "bg-cyan-100 text-cyan-700 border border-cyan-300"
                          : "bg-purple-100 text-purple-700 border border-purple-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid={`button-feedback-type-${t}`}
                  >
                    {t === "bug" ? "Bug Report" : t === "suggestion" ? "Suggestion" : "Other"}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={type === "bug" ? "Describe the issue you encountered..." : "Share your idea or feedback..."}
                className="w-full h-24 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-sm px-3 py-2 resize-none focus:outline-none focus:border-cyan-400 placeholder:text-slate-400"
                maxLength={5000}
                data-testid="textarea-feedback-message"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional, for follow-up)"
                className="w-full rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-sm px-3 py-2 focus:outline-none focus:border-cyan-400 placeholder:text-slate-400"
                data-testid="input-feedback-email"
              />

              {error && (
                <p className="text-xs text-red-600" data-testid="text-feedback-error">{error}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={submitting || !message.trim()}
                className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-sm"
                data-testid="button-submit-feedback"
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Sending...</>
                ) : (
                  <><Send size={14} /> Submit Feedback</>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
