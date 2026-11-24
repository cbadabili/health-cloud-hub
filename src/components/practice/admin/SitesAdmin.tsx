import { useCallback, useEffect, useState } from "react";
import { DoorOpen, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePractice } from "@/hooks/usePractice";
import { formatPhone, normalizePhone } from "@/lib/locale";
import { practiceErrorMessage } from "@/lib/practice";

type Site = Database["public"]["Tables"]["sites"]["Row"];
type Room = Database["public"]["Tables"]["rooms"]["Row"];

/** Practice locations and their consulting rooms (owners and managers). */
const SitesAdmin = () => {
  const { current } = usePractice();
  const [sites, setSites] = useState<Site[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSite, setNewSite] = useState({ name: "", phone: "", address: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    const [s, r] = await Promise.all([
      supabase.from("sites").select("*").eq("practice_id", current.practice_id).order("created_at"),
      supabase.from("rooms").select("*").eq("practice_id", current.practice_id).order("name"),
    ]);
    setSites(s.data ?? []);
    setRooms(r.data ?? []);
    setLoading(false);
  }, [current]);

  useEffect(() => {
    load();
  }, [load]);

  if (!current) return null;

  const addSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSite.name.trim()) return toast.error("Enter a site name.");
    const phone = newSite.phone.trim() ? normalizePhone(newSite.phone, current.country) : null;
    if (newSite.phone.trim() && !phone) return toast.error("That phone number isn't valid.");
    setBusy(true);
    const { error } = await supabase.from("sites").insert({
      practice_id: current.practice_id,
      name: newSite.name.trim(),
      phone_e164: phone,
      address: newSite.address.trim() || null,
      timezone: current.timezone,
    });
    setBusy(false);
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't add the site."));
    setNewSite({ name: "", phone: "", address: "" });
    toast.success("Site added.");
    load();
  };

  const setSiteActive = async (site: Site, active: boolean) => {
    if (!active && sites.filter((s) => s.active).length <= 1) return toast.error("A practice needs at least one open site.");
    const { error } = await supabase.from("sites").update({ active }).eq("id", site.id);
    if (error) return toast.error(practiceErrorMessage(error));
    load();
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-8" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        sites.map((site) => (
          <Card key={site.id} className={site.active ? "" : "opacity-70"}>
            <CardHeader className="flex flex-col gap-2 space-y-0 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-4 w-4" /> {site.name}
                  {!site.active && <Badge variant="secondary">Closed</Badge>}
                </CardTitle>
                <CardDescription>
                  {[site.address, site.phone_e164 && formatPhone(site.phone_e164)].filter(Boolean).join(" · ") || "No address or phone yet"}
                </CardDescription>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={site.active} onCheckedChange={(v) => setSiteActive(site, v)} aria-label={`${site.name} open`} />
                Open
              </label>
            </CardHeader>
            <CardContent>
              <RoomsList site={site} rooms={rooms.filter((r) => r.site_id === site.id)} onChanged={load} />
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add a site</CardTitle>
          <CardDescription>Another branch or location of this practice.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addSite} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-name">Name</Label>
              <Input id="site-name" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-phone">Phone</Label>
              <Input id="site-phone" type="tel" value={newSite.phone} onChange={(e) => setNewSite({ ...newSite, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-address">Address</Label>
              <Input id="site-address" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" disabled={busy}>
                <Plus className="mr-2 h-4 w-4" /> Add site
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const RoomsList = ({ site, rooms, onChanged }: { site: Site; rooms: Room[]; onChanged: () => void }) => {
  const [name, setName] = useState("");
  const [exclusive, setExclusive] = useState(true);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("rooms").insert({ practice_id: site.practice_id, site_id: site.id, name: name.trim(), exclusive });
    if (error) return toast.error(practiceErrorMessage(error, "Couldn't add the room."));
    setName("");
    onChanged();
  };

  const toggle = async (room: Room) => {
    const { error } = await supabase.from("rooms").update({ active: !room.active }).eq("id", room.id);
    if (error) return toast.error(practiceErrorMessage(error));
    onChanged();
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Rooms</h4>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rooms yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {rooms.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => toggle(room)}
                title={room.active ? "Click to close this room" : "Click to reopen this room"}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <DoorOpen className="h-3 w-3" />
                <span className={room.active ? "" : "line-through text-muted-foreground"}>{room.name}</span>
                {room.exclusive && <span className="text-xs text-muted-foreground">· one at a time</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input aria-label={`New room at ${site.name}`} placeholder="e.g. Consulting room 1" value={name} onChange={(e) => setName(e.target.value)} className="sm:max-w-xs" />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={exclusive} onCheckedChange={(v) => setExclusive(v === true)} />
          One patient at a time
        </label>
        <Button type="submit" variant="outline" size="sm">
          Add room
        </Button>
      </form>
    </div>
  );
};

export default SitesAdmin;
