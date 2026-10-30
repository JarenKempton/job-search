import { FileTextIcon, UploadIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { resume as api, type Resume } from "@/web/api";
import { Button } from "@/web/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/web/components/ui/card";
import { Textarea } from "@/web/components/ui/textarea";

const loadPdfReader = () => import("unpdf");

async function readText(file: File) {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))
    return file.text();
  const { extractText, getDocumentProxy } = await loadPdfReader();
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function ResumeCard() {
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
        <CardDescription>
          Only the text is saved. The file stays on your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          id="resume-file"
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
          className="sr-only"
          aria-label="Resume file"
          disabled={busy}
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
            <div className="min-w-0 flex-1 basis-48 text-sm">
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
            <Button variant="outline" size="sm" asChild>
              <label
                htmlFor="resume-file"
                aria-disabled={busy}
                onPointerDown={loadPdfReader}
              >
                <UploadIcon /> {busy ? "Reading…" : "Replace"}
              </label>
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
            <Button size="sm" asChild>
              <label
                htmlFor="resume-file"
                aria-disabled={busy}
                onPointerDown={loadPdfReader}
              >
                <UploadIcon /> {busy ? "Reading…" : "Upload PDF or text"}
              </label>
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
