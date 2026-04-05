'use client';
import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from './GameFrame';

interface BloodButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function BloodButton({
  children,
  className,
  variant = 'primary',
  disabled = false,
  ...props
}: BloodButtonProps) {
  const baseStyles = "relative px-6 py-3 font-space font-bold tracking-widest rounded-xl overflow-hidden transition-all focus:outline-none focus:ring-4 focus:ring-primary/30 active:scale-90 border-b-4";
  
  const variants = {
    primary: "bg-blood text-white border-red-800 shadow-[0_0_20px_rgba(255,46,46,0.3)] hover:brightness-110",
    secondary: "bg-secondary text-dark border-emerald-800 shadow-[0_0_20px_rgba(0,255,171,0.3)] hover:brightness-110",
    ghost: "bg-black/40 text-gray-400 border-gray-800 hover:border-primary hover:text-primary"
  };

  const disabledStyles = disabled ? "opacity-50 grayscale cursor-not-allowed pointer-events-none shadow-none border-b-0 translate-y-[4px]" : "";

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.08, y: -2 } : {}}
      whileTap={!disabled ? { scale: 0.92, y: 2 } : {}}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      className={cn(baseStyles, variants[variant], disabledStyles, className)}
      disabled={disabled}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm">
        {children}
      </span>
    </motion.button>
  );
}
