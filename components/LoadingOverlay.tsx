
import React, { useState, useEffect } from 'react';

export const LoadingOverlay: React.FC = () => {
  const [seconds, setSeconds] = useState(0);
  const expectedDuration = 120; // Increased to 2 minutes for better accuracy

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress slows down as it approaches 100% to avoid "finishing" too early
  const calculateProgress = () => {
    if (seconds >= expectedDuration) {
      // After expected duration, progress very slowly towards 99%
      const overtime = seconds - expectedDuration;
      return Math.min(95 + (overtime / 60) * 4, 99);
    }
    return (seconds / expectedDuration) * 95;
  };

  const progress = calculateProgress();

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-10 shadow-2xl flex flex-col items-center max-w-xl w-full animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-8"></div>
        <h3 className="text-2xl font-extrabold text-slate-800 mb-4">Analyzing Course Alignment</h3>
        <p className="text-lg text-slate-500 text-center mb-6 leading-relaxed">
          Our AI instructional design assistant is listing, organizing, mapping, and evaluating the objectives as well as giving you a draft alignment report. . .
        </p>
        
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-4">
          <div 
            className="bg-blue-600 h-full transition-all duration-1000 ease-linear" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className="flex justify-between w-full text-sm font-medium text-slate-500 mb-6">
          <span>Time elapsed: {formatTime(seconds)}</span>
          <span>Expected Duration: {formatTime(expectedDuration)}</span>
        </div>

        <p className="text-sm text-slate-400 uppercase tracking-widest font-bold">Generating Findings</p>
      </div>
    </div>
  );
};
