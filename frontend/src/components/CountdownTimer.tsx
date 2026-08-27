import { useState, useEffect } from 'react';

export const CountdownTimer = ({ targetDate }: { targetDate: Date | null }) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!targetDate) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <div className="flex items-center gap-3 sm:gap-4 bg-surface-hi/40 border border-white/10 px-4 py-3 rounded-2xl shadow-inner">
      <div className="flex flex-col items-center">
        <span className="text-xl sm:text-2xl font-mono font-black text-accent">
          {timeLeft.days.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold">Days</span>
      </div>
      <span className="text-muted font-bold text-lg -mt-3">:</span>
      <div className="flex flex-col items-center">
        <span className="text-xl sm:text-2xl font-mono font-black text-accent">
          {timeLeft.hours.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold">Hrs</span>
      </div>
      <span className="text-muted font-bold text-lg -mt-3">:</span>
      <div className="flex flex-col items-center">
        <span className="text-xl sm:text-2xl font-mono font-black text-accent">
          {timeLeft.minutes.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold">Min</span>
      </div>
      <span className="text-muted font-bold text-lg -mt-3">:</span>
      <div className="flex flex-col items-center">
        <span className="text-xl sm:text-2xl font-mono font-black text-accent">
          {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted font-bold">Sec</span>
      </div>
    </div>
  );
};
