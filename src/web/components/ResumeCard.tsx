import { FileTextIcon, UploadIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { resume as api, type Resume } from "@/web/api";
import { cn } from "cn";
import { Button } from "@/web/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/web/components/ui/card";
import { Textarea } from "@/web/components/ui/textarea";

const ACCEPT = ".pdf,.txt,application/pdf,text/plain";

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

function UploadButton({
  busy,
  label,
  variant,
  onChange,
}: {
  busy: boolean;
  label: string;
  variant?: "outline";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Button
      size="sm"
      variant={variant}
      asChild
      className={cn(
        "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        busy && "pointer-events-none opacity-50",
      )}
    >
      <label
        aria-busy={busy}
        onPointerDown={() => void loadPdfReader().catch(() => {})}
      >
        <input
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onChange}
        />
        <UploadIcon /> {busy ? "Reading…" : label}
      </label>
    </Button>
  );
}

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
    const input = event.target;
    const file = input.files?.[0];
    if (!file || busy) {
      input.value = "";
      return;
    }
    void run(async () => {
      try {
        const text = (await readText(file)).trim();
        if (!text)
          throw new Error(
            "No text found in that file. Try another file or paste the text instead.",
          );
        setFileName(file.name);
        setDraft(text);
      } finally {
        input.value = "";
      }
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
            <UploadButton
              busy={busy}
              label="Replace"
              variant="outline"
              onChange={choose}
            />
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
            <UploadButton
              busy={busy}
              label="Upload PDF or text"
              onChange={choose}
            />
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
