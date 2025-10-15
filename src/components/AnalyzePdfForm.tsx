"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { analyzePdfWithGeminiAction } from "@/actions/notes";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { FileText, Loader2, Upload } from "lucide-react";

type Props = {
  user: User | null;
};

function AnalyzePdfForm({ user }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }

    if (!selectedFile) {
      setErrorMessage("Please select a PDF file before submitting.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      try {
        const response = await analyzePdfWithGeminiAction(selectedFile, prompt);
        setResult(response);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong.";
        setErrorMessage(message);
      }
    });
  };

  useEffect(() => {
    if (!open) {
      setErrorMessage(null);
      setSelectedFile(null);
    }
  }, [open]);

  const selectedFileLabel = useMemo(() => {
    if (!selectedFile) return "No file chosen";
    return selectedFile.name.length > 24
      ? `${selectedFile.name.slice(0, 21)}…`
      : selectedFile.name;
  }, [selectedFile]);

  return (
    <div className="self-end">
      <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 rounded-full border-primary/40 bg-background/70 px-4 py-2 text-sm text-primary shadow-sm shadow-primary/20 transition hover:bg-primary/10"
        >
          <FileText className="h-4 w-4" />
          Analyze a PDF
        </Button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className="flex h-full w-full max-w-xl flex-col gap-6 border-border/60 bg-card/95"
      >
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle className="text-primary">
            Analyze a PDF with Gemini
          </SheetTitle>
          <SheetDescription>
            Upload a PDF and optionally provide a prompt. Gemini will read the
            file and return a concise summary in HTML.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 overflow-auto pb-4"
        >
          <div className="flex flex-col gap-3">
            <label
              htmlFor="pdf-upload"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              PDF file
            </label>
            <div className="flex items-center gap-3">
              <label
                htmlFor="pdf-upload"
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
              >
                <Upload className="h-4 w-4" />
                Choose file
              </label>
              <span className="text-xs text-muted-foreground">
                {selectedFileLabel}
              </span>
            </div>
            <input
              id="pdf-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="pdf-prompt"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Prompt (optional)
            </label>
            <Textarea
              id="pdf-prompt"
              placeholder="Provide extra context or instructions for Gemini..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-[120px] rounded-xl border border-border/50 bg-background/50 text-sm shadow-inner shadow-black/10 focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}

          <Button
            type="submit"
            className="flex items-center justify-center gap-2 self-start rounded-full bg-primary px-6 py-2 text-sm text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Analyze PDF
              </>
            )}
          </Button>
        </form>

        {result && (
          <div className="custom-scrollbar flex-1 overflow-y-auto rounded-xl border border-border/60 bg-background/40 p-4 text-sm leading-relaxed">
            <p
              className="bot-response text-foreground"
              dangerouslySetInnerHTML={{ __html: result }}
            />
          </div>
        )}
      </SheetContent>
      </Sheet>
    </div>
  );
}

export default AnalyzePdfForm;
