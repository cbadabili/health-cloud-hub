import { useId, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  CERTIFICATE_ACCEPT,
  formatFileSize,
  validateCertificateFile,
} from "@/lib/doctorVerification";

interface CertificatePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  /** Short note under the label, e.g. why it's needed. */
  hint?: string;
  label?: string;
}

/** File picker for a registration certificate (PDF/JPG/PNG, max 5 MB). */
const CertificatePicker = ({
  file,
  onChange,
  required = false,
  hint,
  label = "Registration certificate",
}: CertificatePickerProps) => {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    const problem = validateCertificateFile(selected);
    setError(problem);
    onChange(problem ? null : selected);
    // Allow choosing the same file again after removing it.
    e.target.value = "";
  };

  const clear = () => {
    onChange(null);
    setError(null);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{" "}
        <span className="font-normal text-muted-foreground">{required ? "(required)" : "(recommended)"}</span>
      </Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {file ? (
        <div className="flex items-center gap-3 rounded-md border border-input bg-background p-3">
          <FileText className="h-5 w-5 shrink-0 text-medical-blue" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={clear} aria-label="Remove file">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-background px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Choose a file</span>
          <span className="text-xs text-muted-foreground">PDF, JPG or PNG, up to 5 MB</span>
        </label>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={CERTIFICATE_ACCEPT}
        onChange={handleSelect}
        className="sr-only"
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default CertificatePicker;
