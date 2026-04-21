import React from 'react';

interface NecroLogProps {
  logs: string[];
}

export function NecroLog({ logs }: NecroLogProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
      {logs.map((log, i) => {
        const isUnlock = log.includes('unlocked');
        const isQuest = log.includes('cleared') || log.includes('complete');
        
        return (
          <div 
            key={i} 
            className={`animate-in fade-in slide-in-from-right-4 duration-500 p-4 rounded-2xl bg-white/5 border-l-2 relative overflow-hidden
              ${isUnlock ? 'border-primary' : isQuest ? 'border-secondary' : 'border-gray-700'}`}
          >
            <div className={`text-[8px] font-bold tracking-[0.2em] uppercase mb-1 
              ${isUnlock ? 'text-primary' : isQuest ? 'text-secondary' : 'text-gray-500'}`}>
              {isUnlock ? 'New Minion Available' : isQuest ? 'Quest Complete' : 'System Log'}
            </div>
            <div className="text-[10px] font-medium text-gray-300 leading-relaxed">
              {log}
            </div>
          </div>
        );
      })}
      {logs.length === 0 && (
        <div className="text-gray-600 italic flex items-center gap-3 mt-4 justify-center uppercase font-bold tracking-widest text-[9px]">
          <div className="w-1 h-1 rounded-full bg-gray-700 animate-pulse" />
          No Soul Data
        </div>
      )}
    </div>
  );
}
