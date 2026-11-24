import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePractice } from "@/hooks/usePractice";
import { COUNTRIES, type CountryCode } from "@/lib/locale";
import { practiceErrorMessage } from "@/lib/practice";

/** "Create your practice": country, name and first site. The creator becomes the owner. */
const Onboarding = () => {
  const { signOut } = useAuth();
  const { practices, loading, refresh } = usePractice();
  const navigate = useNavigate();
  const [country, setCountry] = useState<CountryCode>("BW");
  const [name, setName] = useState("");
  const [siteName, setSiteName] = useState("Main site");
  const [busy, setBusy] = useState(false);

  if (!loading && practices.length > 0 && !busy) return <Navigate to="/dashboard" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Enter your practice name.");
    setBusy(true);
    const { error } = await supabase.rpc("create_practice", {
      _name: name.trim(),
      _country: country,
      _site_name: siteName.trim() || "Main site",
    });
    if (error) {
      setBusy(false);
      return toast.error(practiceErrorMessage(error, "Couldn't create the practice. Please try again."));
    }
    await refresh();
    toast.success(`${name.trim()} is ready.`);
    navigate("/dashboard", { replace: true });
  };

  const c = COUNTRIES[country];

  return (
    <div className="min-h-screen bg-gradient-hero">
      <header className="flex justify-end gap-2 p-4">
        <ThemeToggle />
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </header>
      <main className="flex justify-center px-4 pb-8">
        <Card className="w-full max-w-lg shadow-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 rounded-full bg-medical-light-blue p-3">
              <Building2 className="h-6 w-6 text-medical-blue" />
            </div>
            <CardTitle>Set up your practice</CardTitle>
            <CardDescription>You'll be the owner and can invite reception, nurses and other staff next.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Country</legend>
                <RadioGroup value={country} onValueChange={(v) => setCountry(v as CountryCode)} className="grid grid-cols-2 gap-2">
                  {(Object.keys(COUNTRIES) as CountryCode[]).map((code) => (
                    <Label
                      key={code}
                      htmlFor={`country-${code}`}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`country-${code}`} value={code} />
                      {COUNTRIES[code].name}
                    </Label>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Sets the currency ({c.currency}), time zone ({c.timezone.replace("_", " ")}) and ID types. This can't be
                  changed later.
                </p>
              </fieldset>
              <div className="space-y-1.5">
                <Label htmlFor="ob-name">Practice name</Label>
                <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Broadhurst Family Clinic" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-site">First site</Label>
                <Input id="ob-site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
                <p className="text-xs text-muted-foreground">You can add more branches later.</p>
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create practice
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Onboarding;
