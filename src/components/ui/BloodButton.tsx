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
  const baseStyles = "relative px-6 py-3 font-cinzel font-bold tracking-widest rounded-md overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-blood/50";
  
  const variants = {
    primary: "bg-blood text-white border-2 border-red-500 shadow-[0_0_15px_rgba(136,8,8,0.6)] hover:bg-red-800",
    secondary: "bg-dark/80 text-gray-300 border-2 border-gray-700 hover:border-blood hover:text-white",
    ghost: "bg-transparent text-gray-400 hover:text-blood hover:bg-blood/10 border border-transparent hover:border-blood/50"
  };

  const disabledStyles = disabled ? "opacity-50 grayscale cursor-not-allowed pointer-events-none shadow-none" : "";

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={cn(baseStyles, variants[variant], disabledStyles, className)}
      disabled={disabled}
      {...props}
    >
      {/* 脈打つ発光エフェクト */}
      {!disabled && variant === 'primary' && (
        <span className="absolute inset-0 bg-gradient-to-t from-red-600/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}
