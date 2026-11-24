import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { errorMessage } from "@/lib/errors";

type Stage = "checking" | "ok" | "enroll" | "challenge";

interface StaffMfaGateProps {
  /** Whether the current practice requires a second factor. */
  required: boolean;
  /** Called after the session reaches aal2, so practice data can be reloaded. */
  onVerified: () => void;
  children: React.ReactNode;
}

/**
 * Before staff see practice data, make sure their session has a second factor
 * (aal2) when the practice requires it. The database enforces the same rule;
 * this screen just explains it and lets them set it up.
 */
const StaffMfaGate = ({ required, onVerified, children }: StaffMfaGateProps) => {
  const { signOut } = useAuth();
  const [stage, setStage] = useState<Stage>("checking");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!required) {
      setStage("ok");
      return;
    }
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") {
      setStage("ok");
      return;
    }
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0];
    if (verified) {
      setFactorId(verified.id);
      setStage("challenge");
    } else {
      setStage("enroll");
    }
  }, [required]);

  useEffect(() => {
    check();
  }, [check]);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    // Remove half-finished set-ups so a fresh QR code can be issued.
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Clinithetics" });
    setBusy(false);
    if (enrollError || !data) {
      setError(errorMessage(enrollError, "Couldn't start set-up. Please try again."));
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError("That code didn't work. Check the time on your phone and try the newest code.");
      setCode("");
      return;
    }
    setStage("ok");
    onVerified();
  };

  if (stage === "ok") return <>{children}</>;

  if (stage === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center" aria-live="polite" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const codeForm = (
    <form onSubmit={verify} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="mfa-code">6-digit code</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder="123456"
          className="text-center text-lg tracking-[0.5em]"
          autoFocus
        />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={busy}>
        {busy ? "Checking..." : "Verify"}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="flex justify-end gap-2 p-4">
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </header>
      <main className="flex justify-center px-4 pb-8">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 rounded-full bg-medical-light-blue p-3">
              {stage === "enroll" ? <ShieldCheck className="h-6 w-6 text-medical-blue" /> : <KeyRound className="h-6 w-6 text-medical-blue" />}
            </div>
            <CardTitle>{stage === "enroll" ? "Protect your account" : "Enter your security code"}</CardTitle>
            <CardDescription>
              {stage === "enroll"
                ? "Your practice requires two-step sign-in for staff, because Clinithetics holds patient records. Set it up once with an authenticator app such as Google Authenticator or Microsoft Authenticator."
                : "Open your authenticator app and enter the current code for Clinithetics."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p role="alert" className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            {stage === "challenge" && codeForm}
            {stage === "enroll" && !qrCode && (
              <Button variant="hero" className="w-full" onClick={startEnrollment} disabled={busy}>
                {busy ? "Preparing..." : "Set up two-step sign-in"}
              </Button>
            )}
            {stage === "enroll" && qrCode && (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Scan this code with your authenticator app.</li>
                  <li>Enter the 6-digit code it shows.</li>
                </ol>
                <div className="flex justify-center rounded-lg bg-white p-3">
                  <img src={qrCode} alt="QR code for your authenticator app" className="h-44 w-44" />
                </div>
                {secret && (
                  <p className="break-all text-center text-xs text-muted-foreground">
                    Can't scan? Enter this key instead: <span className="font-mono text-foreground">{secret}</span>
                  </p>
                )}
                {codeForm}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default StaffMfaGate;
