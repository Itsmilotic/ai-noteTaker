"use client";

import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "./ui/textarea";
import { ArrowUpIcon } from "lucide-react";
import {
  askAIAboutNotesAction,
  generateQuestionsAboutNotesAction,
} from "@/actions/notes";
import "@/styles/ai-response.css";

type Props = {
  user: User | null;
};

function AskAIButton({ user }: Props) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const [open, setOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [responses, setResponses] = useState<string[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(3);

  const handleOnOpenChange = (isOpen: boolean) => {
    if (!user) {
      router.push("/login");
    } else {
      if (isOpen) {
        setQuestionText("");
        setQuestions([]);
        setResponses([]);
        setSuggestedQuestions([]);
        setSuggestionsError(null);
      }
      setOpen(isOpen);
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleClickInput = () => {
    textareaRef.current?.focus();
  };

  const sendQuestion = (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    const updatedQuestions = [...questions, trimmedQuestion];
    const currentResponsesSnapshot = [...responses];

    setQuestions(updatedQuestions);
    setQuestionText("");
    setTimeout(scrollToBottom, 100);

    startTransition(async () => {
      const response = await askAIAboutNotesAction(
        updatedQuestions,
        currentResponsesSnapshot,
      );
      setResponses((prev) => [...prev, response]);

      setTimeout(scrollToBottom, 100);
    });
  };

  const handleSubmit = () => {
    sendQuestion(questionText);
  };

  const scrollToBottom = () => {
    contentRef.current?.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: "smooth",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleGenerateSuggestions = async () => {
    if (!user) {
      router.push("/login");
      return;
    }

    setSuggestionsError(null);
    setIsGeneratingSuggestions(true);
    try {
      const generated = await generateQuestionsAboutNotesAction(questionCount);
      setSuggestedQuestions(generated);
      if (generated.length === 0) {
        setSuggestionsError(
          "No suggestions available yet. Try adding more detail to your notes.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate questions";
      setSuggestionsError(message);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const questionCountLabel = useMemo(() => {
    if (questionCount === 1) return "1 question";
    return `${questionCount} questions`;
  }, [questionCount]);

  const handleAskSuggestion = (suggestion: string) => {
    sendQuestion(suggestion);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogTrigger asChild>
        <Button className="shadow-lg shadow-primary/30">Ask AI</Button>
      </DialogTrigger>
      <DialogContent
        className="custom-scrollbar flex h-[85vh] max-w-4xl flex-col overflow-y-auto border border-border/60 bg-card/95"
        ref={contentRef}
      >
        <DialogHeader>
          <DialogTitle className="text-primary">
            Ask AI About Your Notes
          </DialogTitle>
          <DialogDescription>
            Out AI can answer questions about all of your notes
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border/40 bg-background/30 p-3 shadow-inner shadow-black/10">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Suggestion helper</span>
            <span className="text-[11px] font-medium text-muted-foreground/80">
              {questionCountLabel}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={6}
              value={questionCount}
              onChange={(event) =>
                setQuestionCount(Number(event.target.value))
              }
              className="range-thumb h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-secondary/60 accent-primary"
            />
            <span className="w-8 text-right text-[11px] text-muted-foreground">
              {questionCount}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateSuggestions}
              disabled={isGeneratingSuggestions}
              className="flex-1 border-primary/40 text-primary hover:bg-primary/10"
            >
              {isGeneratingSuggestions ? "Generating…" : "Generate"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSuggestedQuestions([])}
              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
          {suggestionsError && (
            <p className="mt-2 text-xs text-destructive">{suggestionsError}</p>
          )}
        </div>

        {suggestedQuestions.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border/30 bg-secondary/20 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested questions
              </h3>
              <span className="text-[10px] uppercase text-muted-foreground/60">
                tap to ask
              </span>
            </div>
            <ul className="grid gap-2">
              {suggestedQuestions.map((suggestion, index) => (
                <li key={`${suggestion}-${index}`}>
                  <button
                    type="button"
                    onClick={() => handleAskSuggestion(suggestion)}
                    className="w-full rounded-lg border border-border/30 bg-background/70 px-3 py-2 text-left text-xs text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-6">
          {questions.map((question, index) => (
            <Fragment key={index}>
              <p className="bg-secondary/50 text-foreground/80 ml-auto max-w-[60%] rounded-2xl px-3 py-2 text-sm shadow-sm ring-1 ring-border/40">
                {question}
              </p>
              {responses[index] && (
                <p
                  className="bot-response text-foreground/90 text-sm"
                  dangerouslySetInnerHTML={{ __html: responses[index] }}
                />
              )}
            </Fragment>
          ))}
          {isPending && (
            <p className="animate-pulse text-sm text-primary">Thinking...</p>
          )}
        </div>

        <form
  onSubmit={(event) => {
    event.preventDefault();
    handleSubmit();
  }}
  className="mt-auto flex cursor-text flex-col gap-3 rounded-2xl border border-border/60 bg-secondary/40 p-4"
  onClick={handleClickInput}
>
  <div className="flex items-end gap-3"> {/* <-- horizontal row */}
    <Textarea
      ref={textareaRef}
      placeholder="Ask me anything about your notes..."
      className="flex-1 placeholder:text-muted-foreground resize-none rounded-xl border border-border/40 bg-background/60 p-3 text-sm shadow-inner shadow-black/10 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
      style={{
        minHeight: "0",
        lineHeight: "normal",
      }}
      rows={1}
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      value={questionText}
      onChange={(e) => setQuestionText(e.target.value)}
    />
    <Button
      type="submit"
      disabled={isPending}
      className="flex h-10 w-10 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg shadow-primary/40 hover:bg-primary/90 disabled:opacity-60"
    >
      <ArrowUpIcon className="h-4 w-4" />
    </Button>
  </div>
</form>

      </DialogContent>
    </Dialog>
  );
}

export default AskAIButton;
