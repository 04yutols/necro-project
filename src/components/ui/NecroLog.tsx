import React from 'react';

interface NecroLogProps {
  logs: string[];
}

export function NecroLog({ logs }: NecroLogProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-black/80 border-4 border-white/5 rounded-2xl p-4 font-space text-[12px] text-primary custom-scrollbar flex flex-col gap-2 shadow-inner relative">
      <div className="absolute inset-0 pointer-events-none bg-dot-pattern opacity-10 z-0" />
      <div className="relative z-10 flex flex-col gap-1.5">
        {logs.map((log, i) => (
          <div key={i} className="animate-in fade-in slide-in-from-left-2 duration-300 flex items-start gap-2">
            <span className="text-secondary font-black opacity-80 mt-0.5">»</span>
            <span className="leading-relaxed drop-shadow-[0_0_8px_rgba(224,141,255,0.4)]">{log}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-primary/30 italic animate-pulse flex items-center gap-2 mt-4 justify-center uppercase font-black tracking-widest text-[10px]">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />
            Standby for data...
          </div>
        )}
      </div>
    </div>
  );
}
