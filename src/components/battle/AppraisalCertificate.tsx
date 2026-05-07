'use client';

import { motion } from 'framer-motion';
import { Share2, Download, X } from 'lucide-react';
import { ItemData } from '../../types/game';

interface AppraisalCertificateProps {
  item: ItemData;
  onClose: () => void;
}

export default function AppraisalCertificate({ item, onClose }: AppraisalCertificateProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, rotateY: 90 }}
        animate={{ scale: 1, opacity: 1, rotateY: 0 }}
        className="relative max-w-lg w-full bg-[#f4e4bc] p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[16px] border-[#8b4513] overflow-hidden"
        style={{
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")',
          boxShadow: 'inset 0 0 100px rgba(139, 69, 19, 0.3), 0 0 50px rgba(0,0,0,0.5)'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#5d2e0c] hover:text-black transition-colors"
        >
          <X size={24} />
        </button>

        {/* Decorative Borders */}
        <div className="absolute top-4 left-4 right-4 bottom-4 border-2 border-[#5d2e0c]/30 pointer-events-none" />

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-[#5d2e0c] font-cinzel font-black text-3xl tracking-widest border-b-2 border-[#5d2e0c]/20 pb-2">
            CERTIFICATE OF DISCOVERY
          </h2>
          <p className="text-[#5d2e0c]/60 text-[10px] mt-1 tracking-[0.2em] font-serif uppercase">
            Issued by the Royal Necromancy Archive
          </p>
        </div>

        {/* Item Info */}
        <div className="space-y-6 text-[#2d1b0d] font-serif">
          <div className="flex justify-between items-baseline border-b border-[#5d2e0c]/10 pb-1">
            <span className="text-xs uppercase tracking-tighter opacity-70">Item Name</span>
            <span className="text-xl font-bold italic">{item.name}</span>
          </div>

          <div className="flex justify-between items-baseline border-b border-[#5d2e0c]/10 pb-1">
            <span className="text-xs uppercase tracking-tighter opacity-70">Rarity</span>
            <span className="text-sm font-bold tracking-widest text-[#8b0000] uppercase">
              {item.rarity.replace('_', ' ')}
            </span>
          </div>

          <div className="flex justify-between items-baseline border-b border-[#5d2e0c]/10 pb-1">
            <span className="text-xs uppercase tracking-tighter opacity-70">Serial Number</span>
            <span className="text-lg font-bold font-mono">No. {item.serialNo || '001'}</span>
          </div>

          <div className="flex justify-between items-baseline border-b border-[#5d2e0c]/10 pb-1">
            <span className="text-xs uppercase tracking-tighter opacity-70">Discoverer</span>
            <span className="text-lg font-bold underline decoration-dotted">{item.discovererName || 'Anonymous'}</span>
          </div>

          <div className="mt-8 p-4 bg-black/5 rounded italic text-sm leading-relaxed border border-[#5d2e0c]/10">
            <p className="opacity-80">
              "This artifact was retrieved from the depths of the void. Its resonance with the soul is undeniable. 
              The history of its creation is lost, but its power remains absolute."
            </p>
          </div>
        </div>

        {/* Footer / Seal */}
        <div className="mt-12 flex justify-between items-center">
          <div className="text-[10px] text-[#5d2e0c]/40 font-mono">
            TIMESTAMP: {new Date().toISOString().split('T')[0]}
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-[#8b0000]/40 flex items-center justify-center rotate-12 opacity-60">
            <div className="text-[8px] font-black text-[#8b0000] text-center leading-tight">
              ROYAL<br/>SEAL
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#5d2e0c] text-[#f4e4bc] rounded-md font-bold hover:bg-[#3d1e08] transition-colors shadow-lg">
            <Share2 size={18} /> SHARE
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-[#5d2e0c] text-[#5d2e0c] rounded-md font-bold hover:bg-[#5d2e0c]/10 transition-colors">
            <Download size={18} /> EXPORT
          </button>
        </div>
      </motion.div>
    </div>
  );
}
