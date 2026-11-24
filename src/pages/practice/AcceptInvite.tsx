import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePractice } from "@/hooks/usePractice";
import { COUNTRIES } from "@/lib/locale";
import { ROLE_LABELS, practiceErrorMessage } from "@/lib/practice";
import type { Database } from "@/integrations/supabase/types";

type Preview = Database["public"]["Functions"]["invitation_preview"]["Returns"][number];

const STATUS_TEXT: Record<string, string> = {
  used: "This invitation has already been used.",
  expired: "This invitation has expired. Ask your practice to send a new one.",
  revoked: "This invitation was cancelled by the practice.",
};

/** /invite/:token: see which practice invited you, sign in with the invited email, and join. */
const AcceptInvite = () => {
  const { token = "" } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { refresh } = usePractice();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("invitation_preview", { _token: token }).then(({ data }) => setPreview(data?.[0] ?? null));
  }, [token]);

  const next = encodeURIComponent(`/invite/${token}`);
  const wrongAccount = !!user && !!preview && user.email?.toLowerCase() !== preview.email.toLowerCase();

  const accept = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("accept_invitation", { _token: token });
    if (err) {
      setBusy(false);
      return setError(practiceErrorMessage(err, "Couldn't accept the invitation. Please try again."));
    }
    await refresh();
    navigate("/dashboard", { replace: true });
  };

  const body = () => {
    if (preview === undefined || authLoading) {
      return (
        <div className="flex justify-center py-6" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!preview) return <p className="text-center text-muted-foreground">This invitation link isn't valid. Ask your practice for a new one.</p>;
    if (preview.status !== "open") return <p className="text-center text-muted-foreground">{STATUS_TEXT[preview.status] ?? STATUS_TEXT.expired}</p>;
    if (!user) {
      const signUpRole = preview.role === "clinician" ? "doctor" : "patient";
      return (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Sign in or create an account with <strong className="text-foreground">{preview.email}</strong> to join.
          </p>
          <Button asChild variant="hero" className="w-full">
            <Link to={`/auth?mode=signin&next=${next}&email=${encodeURIComponent(preview.email)}`}>I have an account</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to={`/auth?mode=signup&role=${signUpRole}&next=${next}&email=${encodeURIComponent(preview.email)}`}>Create an account</Link>
          </Button>
        </div>
      );
    }
    if (wrongAccount) {
      return (
        <div className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">
            You're signed in as <strong className="text-foreground">{user.email}</strong>, but this invitation is for{" "}
            <strong className="text-foreground">{preview.email}</strong>.
          </p>
          <Button variant="outline" onClick={signOut}>
            Sign out and switch account
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {error && (
          <p role="alert" className="rounded-md border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        <Button variant="hero" className="w-full" onClick={accept} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join {preview.practice_name}
        </Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="flex justify-end p-4">
        <ThemeToggle />
      </header>
      <main className="flex justify-center px-4 pb-8">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 rounded-full bg-medical-light-blue p-3">
              <MailCheck className="h-6 w-6 text-medical-blue" />
            </div>
            <CardTitle>{preview?.status === "open" ? `Join ${preview.practice_name}` : "Staff invitation"}</CardTitle>
            {preview?.status === "open" && (
              <CardDescription>
                You've been invited as {ROLE_LABELS[preview.role]} · {COUNTRIES[preview.country].name}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>{body()}</CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AcceptInvite;
