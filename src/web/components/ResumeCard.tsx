import { FileTextIcon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { resume as api, type Resume } from "@/web/api";
import { Button } from "@/web/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/web/components/ui/card";
import { Textarea } from "@/web/components/ui/textarea";

async function readText(file: File) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))
    return file.text();
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function ResumeCard() {
  const input = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Resume | null | undefined>(undefined);
  const [draft, setDraft] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get()
      .then(setSaved)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void run(async () => {
      const text = (await readText(file)).trim();
      if (!text)
        throw new Error(
          "No text found in that file. Try another file or paste the text instead.",
        );
      setFileName(file.name);
      setDraft(text);
    });
  }

  const save = () =>
    run(async () => {
      setSaved(await api.save({ text: draft ?? "", fileName }));
      setDraft(null);
      setFileName(null);
    });

  const remove = () =>
    run(async () => {
      if (!window.confirm("Remove your saved resume?")) return;
      await api.remove();
      setSaved(null);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your resume</CardTitle>
        <CardDescription>
          Only the text is saved; the file never leaves your device. Your AI
          tools can read it to judge fit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={input}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="hidden"
          aria-label="Resume file"
          onChange={choose}
        />
        {draft !== null ? (
          <>
            <Textarea
              aria-label="Resume text"
              rows={12}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Review the text. Remove contact details if you like; they aren’t
              needed for matching.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setFileName(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save resume"}
              </Button>
            </div>
          </>
        ) : saved ? (
          <div className="flex flex-wrap items-center gap-3">
            <FileTextIcon
              aria-hidden="true"
              className="size-4 text-muted-foreground"
            />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-medium">
                {saved.fileName ?? "Pasted resume"}
              </p>
              <p className="text-xs text-muted-foreground">
                {words(saved.text).toLocaleString()} words · updated{" "}
                {new Date(saved.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setFileName(saved.fileName);
                setDraft(saved.text);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <UploadIcon /> Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          </div>
        ) : saved === null ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <UploadIcon /> {busy ? "Reading…" : "Upload PDF or text"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setDraft("")}
            >
              Paste text
            </Button>
          </div>
        ) : (
          <p className="muted">Loading…</p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
