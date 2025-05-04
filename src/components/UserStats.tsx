// src/components/UserStats.tsx

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck, Clock, Calendar, TrendingUp } from "lucide-react";

interface UserStatsRow {
    current_streak: number;
    best_time_seconds: number | null;
    best_time_date: string | null;
    total_planks: number;
}

interface UserStatsProps {
    userId?: string;
}

const UserStats: React.FC<UserStatsProps> = ({ userId }) => {
    const [stats, setStats] = useState<UserStatsRow | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    const [monthlyRank, setMonthlyRank] = useState<number | null>(null);
    const [monthlyPercentile, setMonthlyPercentile] = useState<number | null>(
        null
    );
    const [loadingRank, setLoadingRank] = useState(true);

    // 1) load the base stats (streak, best-ever, total planks)
    useEffect(() => {
        async function fetchStats() {
            setLoadingStats(true);
            try {
                let uid = userId;
                if (!uid) {
                    const {
                        data: { user },
                        error: userErr,
                    } = await supabase.auth.getUser();
                    if (userErr || !user) throw userErr || new Error("No user");
                    uid = user.id;
                }

                const { data, error } = await supabase
                    .from<UserStatsRow>("user_stats")
                    .select(
                        "current_streak, best_time_seconds, best_time_date, total_planks"
                    )
                    .eq("user_id", uid)
                    .single();

                if (error && error.code !== "PGRST116") throw error;
                setStats(data);
            } catch (err: any) {
                console.error(err);
                toast.error("Could not load statistics.");
            } finally {
                setLoadingStats(false);
            }
        }

        fetchStats();
    }, [userId]);

    // 2) fetch last-30-day leaderboard, extract this user’s rank & percentile
    useEffect(() => {
        async function fetchRank() {
            setLoadingRank(true);
            try {
                let uid = userId;
                if (!uid) {
                    const {
                        data: { user },
                        error: userErr,
                    } = await supabase.auth.getUser();
                    if (userErr || !user) throw userErr || new Error("No user");
                    uid = user.id;
                }

                // compute 30-day cutoff
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 30);
                const cutoffIso = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"

                // fetch all planks in last 30 days
                const { data: planks, error: plankErr } = await supabase
                    .from<{ user_id: string; duration_s: number }>("planks")
                    .select("user_id, duration_s")
                    .gte("plank_date", cutoffIso);

                if (plankErr) throw plankErr;

                // aggregate total durations per user
                const totals: Record<string, number> = {};
                (planks || []).forEach((p) => {
                    totals[p.user_id] = (totals[p.user_id] || 0) + p.duration_s;
                });

                // build sorted array
                const sorted = Object.entries(totals)
                    .map(([user_id, total_time]) => ({ user_id, total_time }))
                    .sort((a, b) => b.total_time - a.total_time);

                // find this user’s position
                const totalCount = sorted.length;
                const myIndex = sorted.findIndex((e) => e.user_id === uid);

                if (myIndex >= 0) {
                    const rank = myIndex + 1;
                    setMonthlyRank(rank);
                    setMonthlyPercentile((rank / totalCount) * 100);
                } else {
                    setMonthlyRank(null);
                    setMonthlyPercentile(null);
                }
            } catch (err) {
                console.error(err);
                toast.error("Could not load 30-day ranking.");
            } finally {
                setLoadingRank(false);
            }
        }

        fetchRank();
    }, [userId]);

    if (loadingStats || loadingRank) {
        return <div className="text-center py-8">Loading statistics…</div>;
    }

    const {
        current_streak = 0,
        best_time_seconds = 0,
        best_time_date,
        total_planks = 0,
    } = stats || {};

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? "0" + s : s}`;
    };

    const formattedBestDate = best_time_date
        ? new Date(best_time_date).toLocaleDateString("en-US", {
            day: "numeric",
            month: "long",
        })
        : "–";

    const pctText =
        monthlyPercentile != null
            ? `Within top ${monthlyPercentile.toFixed(0)}%`
            : "–";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
            {/* Current Streak */}
            <Card className="plank-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <CalendarCheck className="h-4 w-4 text-plank-blue mr-2" />
                        Current Streak
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{current_streak} days</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {current_streak > 5 ? "Impressive streak!" : "Keep it up!"}
                    </p>
                </CardContent>
            </Card>

            {/* Best Time */}
            <Card className="plank-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <Clock className="h-4 w-4 text-plank-green mr-2" />
                        Best Time
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatTime(best_time_seconds)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Achieved on {formattedBestDate}
                    </p>
                </CardContent>
            </Card>

            {/* Total Planks */}
            <Card className="plank-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <Calendar className="h-4 w-4 text-plank-blue mr-2" />
                        Total Planks
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total_planks}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Since you started
                    </p>
                </CardContent>
            </Card>

            {/* 30-Day Ranking */}
            <Card className="plank-card">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                        <TrendingUp className="h-4 w-4 text-plank-green mr-2" />
                        30-Day Ranking
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {monthlyRank != null ? `#${monthlyRank}` : "–"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pctText}</p>
                </CardContent>
            </Card>
        </div>
    );
};

export default UserStats;
