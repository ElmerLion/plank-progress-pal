import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Clock, Trash2 } from "lucide-react";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import FullHistoryDialog from "./FullHistoryDialog";
import PlankDetailDialog from "./PlankDetailDialog";
import { useAuth } from "@/hooks/useAuth";

export interface PlankEntry {
    id: number;
    date: string;  // e.g. "April 22"
    day: string;   // "Today" | "Yesterday" | "Monday" | …
    time: number;  // seconds
}

interface PlankHistoryProps {
    userId: string;
}

const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
};

const PlankHistory: React.FC<PlankHistoryProps> = ({ userId }) => {
    const { user } = useAuth();
    const [recent, setRecent] = useState<PlankEntry[]>([]);
    const [loadingRecent, setLoadingRecent] = useState(true);

    // Add-new dialog
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newDate, setNewDate] = useState("");
    const [newTime, setNewTime] = useState("00:00");

    const isOwnProfile = user?.id === userId;

    // load latest 5 planks
    const loadRecent = async () => {
        setLoadingRecent(true);
        try {
            const { data: rows, error } = await supabase
                .from<{ id: number; plank_date: string; duration_s: number }>("planks")
                .select("id, plank_date, duration_s, inserted_at")
                .eq("user_id", userId)
                .order("inserted_at", { ascending: false })
                .limit(5);

            if (error) throw error;

            setRecent(
                (rows || []).map(r => {
                    const d = new Date(r.plank_date);
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);

                    let dayLabel: string;
                    if (d.toDateString() === today.toDateString()) dayLabel = "Today";
                    else if (d.toDateString() === yesterday.toDateString()) dayLabel = "Yesterday";
                    else {
                        const wd = d.toLocaleDateString("en-US", { weekday: "long" });
                        dayLabel = wd.charAt(0).toUpperCase() + wd.slice(1);
                    }

                    return {
                        id: r.id,
                        date: d.toLocaleDateString("en-US", { day: "numeric", month: "long" }),
                        day: dayLabel,
                        time: r.duration_s,
                    };
                })
            );
        } catch (err: any) {
            console.error(err);
            toast.error("Could not load plank history.");
        } finally {
            setLoadingRecent(false);
        }
    };

    useEffect(() => {
        loadRecent();
    }, [userId]);

    // handle adding
    const handleAddPlank = async (e: React.FormEvent) => {
        e.preventDefault();
        const [m, s] = newTime.split(":").map(v => parseInt(v, 10));
        if (isNaN(m) || isNaN(s)) {
            toast.error("Invalid time format");
            return;
        }
        const duration_s = m * 60 + s;
        try {
            await supabase.from("planks").insert({
                user_id: userId,
                plank_date: newDate,
                duration_s,
            });
            toast.success("Plank added!");
            setIsAddOpen(false);
            setNewDate("");
            setNewTime("00:00");
            loadRecent();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to add plank.");
        }
    };

    // handle deletion
    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this plank?")) return;
        try {
            await supabase.from("planks").delete().eq("id", id);
            toast.success("Plank deleted");
            loadRecent();
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to delete plank.");
        }
    };

    return (
        <Card>
            <CardHeader className="border-b pb-3 flex items-center justify-between">
                <CardTitle className="text-lg flex items-center">
                    <Clock className="h-5 w-5 text-plank-blue mr-2" />
                    Latest Planks
                </CardTitle>

                {isOwnProfile && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">Add New Plank</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle>Log a New Plank</DialogTitle>
                                <DialogClose />
                            </DialogHeader>
                            <form onSubmit={handleAddPlank} className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-sm font-medium">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newDate}
                                        onChange={e => setNewDate(e.target.value)}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">Time (MM:SS)</label>
                                    <input
                                        type="text"
                                        pattern="\d{1,2}:\d{2}"
                                        placeholder="mm:ss"
                                        required
                                        value={newTime}
                                        onChange={e => setNewTime(e.target.value)}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button type="submit">Save</Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>

            <CardContent className="p-0">
                {loadingRecent ? (
                    <div className="p-6 text-center text-gray-500">Loading…</div>
                ) : (
                    <ul className="divide-y">
                        {recent.map(e => (
                            <PlankDetailDialog
                                key={e.id}
                                plankId={e.id}
                                trigger={
                                    <li className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                                        <div>
                                            <p className="font-medium">{e.day}</p>
                                            <p className="text-sm text-gray-500">{e.date}</p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <div className="h-8 w-8 bg-plank-light-blue rounded-full flex items-center justify-center">
                                                <Clock className="h-4 w-4 text-plank-blue" />
                                            </div>
                                            <span className="font-semibold">{formatTime(e.time)}</span>
                                            {isOwnProfile && (
                                                <button
                                                    onClick={() => handleDelete(e.id)}
                                                    aria-label="Delete plank"
                                                    className="p-1 hover:bg-red-100 rounded"
                                                >
                                                    <Trash2 className="h-5 w-5 text-red-500" />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                }
                            />
                        ))}
                    </ul>
                )}

                <div className="p-4 border-t text-center">
                    <FullHistoryDialog
                        userId={userId}
                        trigger={<Button variant="link">View full history</Button>}
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default PlankHistory;
