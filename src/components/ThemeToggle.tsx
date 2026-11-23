import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** Show a text label next to the icon (used in the mobile menu). */
  showLabel?: boolean;
}

const ThemeToggle = ({ className, showLabel = false }: ThemeToggleProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid a hydration flash: the theme is only known after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button
      type="button"
      variant="outline"
      size={showLabel ? "default" : "icon"}
      className={cn(showLabel ? "justify-start" : "h-9 w-9", className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {showLabel && <span className="ml-2">{isDark ? "Light mode" : "Dark mode"}</span>}
    </Button>
  );
};

export default ThemeToggle;
