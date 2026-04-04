import React from 'react';

interface NecroLogProps {
  logs: string[];
}

export function NecroLog({ logs }: NecroLogProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-black/90 border-2 border-primary/40 rounded-xl p-3 font-mono text-[11px] text-primary drop-shadow-[0_0_5px_rgba(224,141,255,0.5)] custom-scrollbar flex flex-col gap-1 shadow-inner relative">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-primary/5 to-transparent z-0" />
      <div className="relative z-10 flex flex-col gap-1">
        {logs.map((log, i) => (
          <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <span className="opacity-50 mr-2">{'>'}</span>{log}
          </div>
        ))}
        {logs.length === 0 && <div className="text-primary/50 italic animate-pulse">SYSTEM STANDBY...</div>}
      </div>
    </div>
  );
}
