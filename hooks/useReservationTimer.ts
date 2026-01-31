import { useState, useEffect } from 'react';

interface TimerResult {
    timeLeft: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
    formattedTime: string;
}

export function useReservationTimer(expiresAt: string | null): TimerResult {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        if (!expiresAt) {
            setTimeLeft(0);
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const expiry = new Date(expiresAt).getTime();
            const diff = expiry - now;

            if (diff <= 0) {
                setTimeLeft(0);
                return 0;
            } else {
                const seconds = Math.floor(diff / 1000);
                setTimeLeft(seconds);
                return seconds;
            }
        };

        // Calculate immediately
        calculateTimeLeft();

        // Update every second
        const interval = setInterval(() => {
            const remaining = calculateTimeLeft();
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
        timeLeft,
        minutes,
        seconds,
        isExpired: timeLeft === 0 && expiresAt !== null,
        formattedTime,
    };
}
