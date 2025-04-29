// src/components/PlankTimer.tsx

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Pause, RotateCcw, CheckCircle } from "lucide-react";

const PlankTimer: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // --- camera switch state ---
    const [useCamera, setUseCamera] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // --- plank/timer state ---
    const [mode, setMode] = useState<"stopwatch" | "timer">("stopwatch");
    const [seconds, setSeconds] = useState(0);
    const [initialSeconds, setInitialSeconds] = useState(0);
    const [inputMin, setInputMin] = useState(0);
    const [inputSec, setInputSec] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [vowCheat, setVowCheat] = useState(false);

    // --- snapshot storage ---
    const [snapshots, setSnapshots] = useState<Blob[]>([]);

    // 1) start/stop camera only on useCamera toggle
    useEffect(() => {
        if (useCamera) {
            navigator.mediaDevices
                .getUserMedia({ video: true })
                .then((s) => {
                    setStream(s);
                    if (videoRef.current) videoRef.current.srcObject = s;
                })
                .catch(() => {
                    toast.error("Camera access denied.");
                    setUseCamera(false);
                });
        } else if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            setStream(null);
        }
        return () => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
        };
    }, [useCamera]);

    // 2) timer / stopwatch
    useEffect(() => {
        if (!isActive) return;
        const timerId = window.setInterval(() => {
            setSeconds((s) => {
                if (mode === "timer") {
                    if (s <= 1) {
                        clearInterval(timerId);
                        handleComplete();
                        return 0;
                    }
                    return s - 1;
                }
                return s + 1;
            });
        }, 1000);
        return () => clearInterval(timerId);
    }, [isActive, mode]);

    // 3) snapshots: once on start + every 10 seconds
    useEffect(() => {
        if (!isActive || !useCamera) return;
        captureSnapshot();
        const snapId = window.setInterval(captureSnapshot, 10_000);
        return () => clearInterval(snapId);
    }, [isActive, useCamera]);

    const formatTime = (t: number) =>
        `${Math.floor(t / 60)
            .toString()
            .padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

    function captureSnapshot() {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                console.log("📸 captured blob:", blob);
                setSnapshots((cur) => [...cur, blob].slice(0, 3));
            }
        }, "image/png");
    }

    const handleStart = () => {
        if (!vowCheat) {
            toast.error("You must swear you won’t cheat before you start!");
            return;
        }
        const total = mode === "timer" ? inputMin * 60 + inputSec : 0;
        if (mode === "timer" && total <= 0) {
            toast.error("Please set a positive timer.");
            return;
        }
        if (mode === "timer") {
            setInitialSeconds(total);
            setSeconds(total);
        } else {
            setSeconds(0);
        }
        setSnapshots([]);
        setIsActive(true);
        setIsCompleted(false);
    };

    const handlePause = () => setIsActive(false);

    const handleReset = () => {
        setIsActive(false);
        setIsCompleted(false);
        setSeconds(0);
        setInputMin(0);
        setInputSec(0);
        setVowCheat(false);
        setUseCamera(false);
        setSnapshots([]);
    };

    const handleComplete = async (): Promise<void> => {
        const duration = mode === "timer" ? initialSeconds : seconds;
        setIsActive(false);
        setIsCompleted(true);
        setSeconds(duration);

        // 1) make sure we're logged in
        const {
            data: { user },
            error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) {
            toast.error("You must be logged in.");
            return;
        }

        // 2) insert new plank and get its id back
        const { data: plankArr, error: plankErr } = await supabase
            .from("planks")
            .insert({ user_id: user.id, duration_s: duration })
            .select("id")
            .limit(1);
        if (plankErr || !plankArr?.length) {
            console.error(plankErr);
            toast.error("Could not save plank.");
            return;
        }
        const plankId = plankArr[0].id;

        // 3) upload up to three camera snapshots
        const photoPaths: string[] = [];
        for (let i = 0; i < snapshots.length; i++) {
            const fileName = `${user.id}_${plankId}_${i}.png`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from("plank-photos")
                .upload(fileName, snapshots[i], { cacheControl: "3600", upsert: false });

            if (uploadErr) {
                console.error("Storage upload error:", uploadErr);
                toast.error("Could not upload photo. " + uploadErr.message);
            } else {
                photoPaths.push(uploadData.path);
            }
        }

        // 4) save the photo paths array back on the plank record
        if (photoPaths.length) {
            const { error: updateErr } = await supabase
                .from("planks")
                .update({ photos: photoPaths })
                .eq("id", plankId);

            if (updateErr) {
                console.error("Failed to attach photos to plank:", updateErr);
            }
        }

        toast.success("Plank saved!");
    };

    return (
        <Card className="plank-card w-full max-w-md mx-auto overflow-hidden">
            <div className="bg-gradient-to-r from-plank-blue to-plank-green p-4 text-white">
                <h2 className="text-xl font-bold font-poppins text-center">
                    Today's Plank
                </h2>
            </div>
            <CardContent className="p-6">
                {/* mode tabs */}
                {!isCompleted && (
                    <div className="flex mb-4 border-b">
                        <button
                            onClick={() => !isActive && setMode("stopwatch")}
                            disabled={isActive}
                            className={`flex-1 py-2 text-center ${mode === "stopwatch"
                                    ? "border-b-2 border-white font-semibold"
                                    : "text-gray-500"
                                } ${isActive ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                            Stopwatch
                        </button>
                        <button
                            onClick={() => !isActive && setMode("timer")}
                            disabled={isActive}
                            className={`flex-1 py-2 text-center ${mode === "timer"
                                    ? "border-b-2 border-white font-semibold"
                                    : "text-gray-500"
                                } ${isActive ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                            Timer
                        </button>
                    </div>
                )}

                {/* camera switch */}
                {!isCompleted && (
                    <div className="flex flex-col items-center mb-4">
                        <label className="inline-flex items-center cursor-pointer">
                            <span className="mr-3 text-sm text-gray-700">Use Camera</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={useCamera}
                                    disabled={isActive}
                                    onChange={() => setUseCamera((c) => !c)}
                                />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-plank-blue peer-focus:ring-2 peer-focus:ring-plank-blue transition" />
                                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full peer-checked:translate-x-5 transition" />
                            </div>
                        </label>
                        <p className="mt-2 text-xs text-gray-500">
                            To get a verified plank you need to use the camera.
                        </p>
                    </div>
                )}


                {/* camera preview */}
                {useCamera && !isCompleted && (
                    <div className="flex justify-center mb-4">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-48 object-cover rounded-md border"
                        />
                    </div>
                )}

                {/* main content */}
                {isCompleted ? (
                    <div className="text-center py-6 animate-fade-in">
                        <CheckCircle className="inline-block w-16 h-16 text-plank-green mb-4" />
                        <h3 className="text-2xl font-bold mb-2">Well done!</h3>
                        <p className="text-gray-600 mb-4">
                            You planked for {formatTime(seconds)}
                        </p>
                        <Button
                            className="plank-btn-outline hover:text-white hover:scale-105"
                            onClick={handleReset}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            New plank
                        </Button>
                    </div>
                ) : mode === "stopwatch" ? (
                    <>
                        <div className="flex justify-center items-center my-8">
                            <div className="relative">
                                {isActive && (
                                    <span className="absolute inset-0 rounded-full animate-pulse-ring bg-plank-blue opacity-30" />
                                )}
                                <div className={`w-36 h-36 rounded-full flex items-center justify-center ${isActive ? "bg-plank-blue" : "bg-gray-100"
                                    }`}>
                                    <span className={`text-3xl font-bold ${isActive ? "text-white" : "text-gray-700"
                                        }`}>
                                        {formatTime(seconds)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {!isActive && (
                            <div className="flex items-center justify-center mb-4">
                                <input
                                    id="no-cheat"
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={vowCheat}
                                    onChange={(e) => setVowCheat(e.target.checked)}
                                />
                                <label htmlFor="no-cheat" className="ml-2 text-sm text-gray-700">
                                    I solemnly swear my plank is real.
                                </label>
                            </div>
                        )}
                        <div className="flex flex-wrap justify-center gap-3 mt-6">
                            {!isActive ? (
                                <Button className="plank-btn-primary flex-grow" onClick={handleStart}>
                                    <Play className="mr-2 h-4 w-4" /> Start
                                </Button>
                            ) : (
                                <Button className="plank-btn-outline flex-grow" onClick={handlePause}>
                                    <Pause className="mr-2 h-4 w-4" /> Pause
                                </Button>
                            )}
                            {seconds > 0 && (
                                <>
                                    <Button className="plank-btn-outline flex-grow" onClick={handleReset}>
                                        <RotateCcw className="mr-2 h-4 w-4" /> Reset
                                    </Button>
                                    {!isActive && (
                                        <Button className="plank-btn-secondary flex-grow" onClick={handleComplete}>
                                            <CheckCircle className="mr-2 h-4 w-4" /> Save plank
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {!isActive && (
                            <div className="flex justify-center mb-4 space-x-4">
                                <div className="text-center">
                                    <label className="block text-sm text-gray-700">Min</label>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-16 p-1 border rounded text-center"
                                        value={inputMin}
                                        onChange={(e) => setInputMin(Number(e.target.value))}
                                    />
                                </div>
                                <div className="text-center">
                                    <label className="block text-sm text-gray-700">Sec</label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        className="w-16 p-1 border rounded text-center"
                                        value={inputSec}
                                        onChange={(e) => setInputSec(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex justify-center items-center my-8">
                            <div className="relative">
                                {isActive && (
                                    <span className="absolute inset-0 rounded-full animate-pulse-ring bg-plank-blue opacity-30" />
                                )}
                                <div className={`w-36 h-36 rounded-full flex items-center justify-center ${isActive ? "bg-plank-blue" : "bg-gray-100"
                                    }`}>
                                    <span className={`text-3xl font-bold ${isActive ? "text-white" : "text-gray-700"
                                        }`}>
                                        {formatTime(seconds)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {!isActive && (
                            <div className="flex items-center justify-center mb-4">
                                <input
                                    id="no-cheat-timer"
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={vowCheat}
                                    onChange={(e) => setVowCheat(e.target.checked)}
                                />
                                <label htmlFor="no-cheat-timer" className="ml-2 text-sm text-gray-700">
                                    I solemnly swear my plank is real.
                                </label>
                            </div>
                        )}
                        <div className="flex flex-wrap justify-center gap-3 mt-6">
                            {!isActive ? (
                                <Button className="plank-btn-primary flex-grow" onClick={handleStart}>
                                    <Play className="mr-2 h-4 w-4" /> Start
                                </Button>
                            ) : (
                                <Button className="plank-btn-outline flex-grow" onClick={handlePause}>
                                    <Pause className="mr-2 h-4 w-4" /> Pause
                                </Button>
                            )}
                            {(inputMin > 0 || inputSec > 0) && !isActive && (
                                <Button className="plank-btn-outline flex-grow" onClick={handleReset}>
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default PlankTimer;
