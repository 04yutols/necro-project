import React, { useRef, useEffect } from 'react';

interface NecroLogProps {
  logs: string[];
}

export function NecroLog({ logs }: NecroLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div 
      ref={scrollRef}
      className="w-full h-full overflow-y-auto custom-scrollbar flex flex-col gap-0.5 p-1 bg-black font-mono text-[9px] leading-tight"
    >
      {logs.map((log, i) => (
        <div 
          key={i} 
          className={`border-b border-transparent py-0.5
            ${log.includes('!') ? 'text-secondary font-bold' : 'text-gray-500'}
            ${log.includes('撃破') ? 'text-green-500' : ''}
            ${log.includes('ダメージ') ? 'text-red-900' : ''}
          `}
        >
          <span className="opacity-30 mr-1 text-[7px]">[{String(i).padStart(3, '0')}]</span>
          {log}
        </div>
      ))}
    </div>
  );
}
