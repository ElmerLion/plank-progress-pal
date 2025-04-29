// src/components/AchievementBadges.tsx

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";

//
// Raw row coming back from badges joined to user_badges
//
type RawBadgeRow = {
    id: number;
    name: string;
    icon_url: string;          // your emoji/icon string
    description: string;
    criteria: { [key: string]: any };
    user_badges: {
        progress: number;
        max_progress: number;
        earned_at: string | null;
        user_id: string;
    }[];
};

//
// Our flattened type for the UI
//
type BadgeRow = Omit<RawBadgeRow, "user_badges"> & {
    user_badges: RawBadgeRow["user_badges"][0] | null;
};

interface AchievementBadgesProps {
    userId: string;
}

const AchievementBadges: React.FC<AchievementBadgesProps> = ({ userId }) => {
    const [badges, setBadges] = useState<BadgeRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadBadges = useCallback(async () => {
        setLoading(true);

        // grab only this user's badges
        const { data, error } = await supabase
            .from<RawBadgeRow>("badges")
            .select(`
        id,
        name,
        icon_url,
        description,
        criteria,
        user_badges!inner (
          progress,
          max_progress,
          earned_at,
          user_id
        )
      `)
            .eq("user_badges.user_id", userId);

        if (error) {
            toast.error("Could not load badges");
            setLoading(false);
            return;
        }

        const flattened = (data || []).map((b) => ({
            id: b.id,
            name: b.name,
            icon_url: b.icon_url,
            description: b.description,
            criteria: b.criteria,
            user_badges: b.user_badges[0] ?? null,
        }));

        setBadges(flattened);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        loadBadges();
        // you can add a realtime subscription if you like, hooking into user_badges for userId
    }, [loadBadges]);

    if (loading) {
        return <div className="text-center py-6">Loading achievements…</div>;
    }

    return (
        <Card className="plank-card">
            <CardHeader className="pb-2 border-b">
                <CardTitle className="text-lg font-poppins">
                    Achievements and Awards
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                    <TooltipProvider delayDuration={300}>
                        {badges.map((b) => {
                            const ub = b.user_badges!;
                            const achieved = Boolean(ub.earned_at);
                            const pct = ub.max_progress
                                ? Math.min(100, (ub.progress / ub.max_progress) * 100)
                                : 0;

                            return (
                                <Tooltip key={b.id}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`aspect-square rounded-lg flex flex-col items-center justify-center p-2 cursor-pointer border-2 transition-all ${achieved
                                                    ? "border-plank-green bg-green-50"
                                                    : "border-dashed border-gray-300"
                                                }`}
                                        >
                                            <div className="text-3xl mb-1">{b.icon_url}</div>
                                            <span
                                                className={`text-xs font-medium text-center ${achieved ? "text-plank-green" : "text-gray-500"
                                                    }`}
                                            >
                                                {b.name}
                                            </span>
                                            {!achieved && ub.max_progress > 0 && (
                                                <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                                                    <div
                                                        className="h-full bg-plank-blue"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <div className="text-sm p-1">
                                            <p className="font-semibold">{b.name}</p>
                                            <p className="text-xs text-gray-500">{b.description}</p>
                                            {achieved ? (
                                                <p className="text-xs text-plank-green mt-1">
                                                    Achieved:{" "}
                                                    {new Date(ub.earned_at!).toLocaleDateString(
                                                        "en-US",
                                                        { day: "numeric", month: "long", year: "numeric" }
                                                    )}
                                                </p>
                                            ) : ub.max_progress > 0 ? (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Progress: {ub.progress}/{ub.max_progress}
                                                </p>
                                            ) : null}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>
            </CardContent>
        </Card>
    );
};

export default AchievementBadges;
