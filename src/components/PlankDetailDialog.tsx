// src/components/PlankDetailDialog.tsx

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface PlankDetailDialogProps {
    plankId: number;
    trigger: React.ReactNode;
}

interface PlankDetail {
    duration_s: number;
    photos: string[];
    user_id: string;
    author: {
        full_name: string;
        profile_image: string;
    };
}

const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s < 10 ? "0" + s : s}`;
};

const PlankDetailDialog: React.FC<PlankDetailDialogProps> = ({
    plankId,
    trigger,
}) => {
    const [open, setOpen] = useState(false);
    const [detail, setDetail] = useState<PlankDetail | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);

        (async () => {
            // 1) fetch the plank itself
            const { data: plank, error: plankErr } = await supabase
                .from("planks")
                .select("duration_s, photos, user_id")
                .eq("id", plankId)
                .single();

            if (plankErr || !plank) {
                console.error("Error loading plank:", plankErr);
                toast.error("Could not load plank details.");
                setLoading(false);
                return;
            }

            // 2) fetch its author
            const { data: author, error: authorErr } = await supabase
                .from("profiles")
                .select("full_name, profile_image")
                .eq("id", plank.user_id)
                .single();

            if (authorErr || !author) {
                console.error("Error loading author:", authorErr);
                toast.error("Could not load author details.");
                setLoading(false);
                return;
            }

            setDetail({
                duration_s: plank.duration_s,
                photos: plank.photos || [],
                user_id: plank.user_id,
                author,
            });
            setLoading(false);
        })();
    }, [open, plankId]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Plank Details</DialogTitle>
                    <DialogClose />
                </DialogHeader>

                <CardContent className="space-y-4">
                    {loading || !detail ? (
                        <p className="text-center text-gray-500 py-6">Loading…</p>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3">
                                <img
                                    src={detail.author.profile_image}
                                    alt={detail.author.full_name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div>
                                    <p className="font-medium">{detail.author.full_name}</p>
                                    <p className="flex items-center text-gray-600">
                                        <Clock className="mr-1 w-4 h-4" />
                                        {formatTime(detail.duration_s)}
                                    </p>
                                </div>
                            </div>

                            {detail.photos.length > 0 && (
                                <div>
                                    <p className="text-lg font-semibold mb-2">Plank Photos</p>
                                    <div className="space-y-4">
                                        {detail.photos.map((path, i) => {
                                            const { data, error } = supabase
                                                .storage
                                                .from("plank-photos")
                                                .getPublicUrl(path);

                                            if (error || !data) {
                                                console.error(
                                                    "Could not get public URL for",
                                                    path,
                                                    error
                                                );
                                                return null;
                                            }

                                            return (
                                                <div key={i} className="overflow-auto">
                                                    <img
                                                        src={data.publicUrl}
                                                        alt={`Snapshot ${i + 1}`}
                                                        className="max-w-full h-auto object-contain rounded"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </DialogContent>
        </Dialog>
    );
};

export default PlankDetailDialog;
