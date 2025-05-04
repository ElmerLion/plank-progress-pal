// src/components/Leaderboard.tsx

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";

type BestEntry = {
    user_id: string;
    full_name: string;
    profile_image: string;
    best_time: number;
    rank: number;
};

type TotalEntry = {
    user_id: string;
    full_name: string;
    profile_image: string;
    total_time: number;
    rank: number;
};

const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
};

const Leaderboard: React.FC = () => {
    const [best, setBest] = useState<BestEntry[]>([]);
    const [total, setTotal] = useState<TotalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        async function loadLeaderboard() {
            setLoading(true);
            try {
                // 1) Compute the cutoff date (30 days ago)
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - 30);
                const cutoffIso = cutoff.toISOString().split("T")[0]; // "YYYY-MM-DD"

                // 2) Fetch planks in that window
                const { data: planks, error: plankErr } = await supabase
                    .from<{ user_id: string; duration_s: number }>("planks")
                    .select("user_id, duration_s")
                    .gte("plank_date", cutoffIso);

                if (plankErr) throw plankErr;

                // 3) Group durations by user
                const stats: Record<string, number[]> = {};
                planks!.forEach((p) => {
                    stats[p.user_id] = stats[p.user_id] || [];
                    stats[p.user_id].push(p.duration_s);
                });

                // 4) Build arrays and rank
                const bestArr = Object.entries(stats)
                    .map(([user_id, durations]) => ({
                        user_id,
                        best_time: Math.max(...durations),
                    }))
                    .sort((a, b) => b.best_time - a.best_time)
                    .map((e, i) => ({ ...e, rank: i + 1 }));

                const totalArr = Object.entries(stats)
                    .map(([user_id, durations]) => ({
                        user_id,
                        total_time: durations.reduce((sum, d) => sum + d, 0),
                    }))
                    .sort((a, b) => b.total_time - a.total_time)
                    .map((e, i) => ({ ...e, rank: i + 1 }));

                // 5) Fetch profile info for all involved users
                const userIds = [...new Set([...bestArr, ...totalArr].map((e) => e.user_id))];
                const { data: profiles, error: profilesErr } = await supabase
                    .from<{ id: string; full_name: string; profile_image: string }>("profiles")
                    .select("id, full_name, profile_image")
                    .in("id", userIds);

                if (profilesErr) throw profilesErr;

                // 6) Merge profile data
                const bestWithProfile: BestEntry[] = bestArr.map((e) => {
                    const p = profiles!.find((pr) => pr.id === e.user_id);
                    return {
                        ...e,
                        full_name: p?.full_name ?? "Unknown",
                        profile_image: p?.profile_image ?? "",
                    };
                });

                const totalWithProfile: TotalEntry[] = totalArr.map((e) => {
                    const p = profiles!.find((pr) => pr.id === e.user_id);
                    return {
                        ...e,
                        full_name: p?.full_name ?? "Unknown",
                        profile_image: p?.profile_image ?? "",
                    };
                });

                setBest(bestWithProfile);
                setTotal(totalWithProfile);
            } catch (err) {
                console.error(err);
                toast.error("Could not load leaderboard.");
            } finally {
                setLoading(false);
            }
        }

        loadLeaderboard();
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="plank-card">
                    <CardContent className="p-6 text-center">Loading…</CardContent>
                </Card>
                <Card className="plank-card">
                    <CardContent className="p-6 text-center">Loading…</CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Best single plank in last 30 days */}
            <Card className="plank-card">
                <CardHeader className="pb-2 border-b flex items-center justify-between">
                    <CardTitle className="text-lg font-poppins flex items-center">
                        <TrendingUp className="h-5 w-5 text-plank-blue mr-2" />
                        Last 30 Days’ Best
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ul className="divide-y">
                        {best.map((e) => (
                            <li
                                key={e.user_id}
                                className="cursor-pointer flex items-center p-4 hover:bg-gray-50 transition-colors"
                                onClick={() => navigate(`/profile/${e.user_id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(ev) => ev.key === "Enter" && navigate(`/profile/${e.user_id}`)}
                            >
                                <div className="w-8 text-center font-bold text-gray-500">{e.rank}</div>
                                <div className="h-10 w-10 rounded-full overflow-hidden mr-3">
                                    <img src={e.profile_image} alt={e.full_name} className="h-full w-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium">{e.full_name}</h3>
                                </div>
                                <div className="text-right font-semibold">{formatTime(e.best_time)}</div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            {/* Total plank time in last 30 days */}
            <Card className="plank-card">
                <CardHeader className="pb-2 border-b flex items-center justify-between">
                    <CardTitle className="text-lg font-poppins flex items-center">
                        <TrendingUp className="h-5 w-5 text-plank-green mr-2" />
                        Last 30 Days’ Total
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ul className="divide-y">
                        {total.map((e) => (
                            <li
                                key={e.user_id}
                                className="cursor-pointer flex items-center p-4 hover:bg-gray-50 transition-colors"
                                onClick={() => navigate(`/profile/${e.user_id}`)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(ev) => ev.key === "Enter" && navigate(`/profile/${e.user_id}`)}
                            >
                                <div className="w-8 text-center font-bold text-gray-500">{e.rank}</div>
                                <div className="h-10 w-10 rounded-full overflow-hidden mr-3">
                                    <img src={e.profile_image} alt={e.full_name} className="h-full w-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium">{e.full_name}</h3>
                                </div>
                                <div className="text-right font-semibold">{formatTime(e.total_time)}</div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
};

export default Leaderboard;
