import React from 'react';

/**
 * 雏菊与常青藤植物意象装饰组件（Daisy & Ivy Botanical Motifs）。
 * 遵循低饱和古籍/羊皮纸审美，零多余依赖，矢量轻量。
 */

export function DaisyIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 align-middle ${className}`}
      aria-hidden="true"
    >
      <g stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round">
        {/* 8 片纯净米白花瓣 */}
        <line x1="12" y1="3" x2="12" y2="7" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="3" y1="12" x2="7" y2="12" />
        <line x1="17" y1="12" x2="21" y2="12" />
        <line x1="5.6" y1="5.6" x2="8.5" y2="8.5" />
        <line x1="15.5" y1="15.5" x2="18.4" y2="18.4" />
        <line x1="5.6" y1="18.4" x2="8.5" y2="15.5" />
        <line x1="15.5" y1="8.5" x2="18.4" y2="5.6" />
      </g>
      {/* 金黄花蕊 */}
      <circle cx="12" cy="12" r="3.2" fill="#cca046" stroke="#b08632" strokeWidth="0.8" />
    </svg>
  );
}

export function IvyTendril({ width = 48, height = 16, className = '' }: { width?: number; height?: number; className?: string }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      {/* 优雅常青藤蔓枝条 */}
      <path
        d="M2 12C14 6 22 15 34 10C44 6 52 14 62 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* 藤叶 1 */}
      <path
        d="M18 10C16 6 12 7 14 11C16 12 18 11 18 10Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* 藤叶 2 */}
      <path
        d="M36 10C38 6 42 7 40 11C38 12 36 11 36 10Z"
        fill="currentColor"
        opacity="0.85"
      />
      {/* 小雏菊点缀 */}
      <circle cx="50" cy="9" r="2" fill="#cca046" />
      <circle cx="50" cy="9" r="3.5" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

export function IvyCornerFleuron({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute pointer-events-none opacity-40 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M2 22V8C2 4.68629 4.68629 2 8 2H22"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="8" r="2.5" fill="#cca046" />
      <path
        d="M14 2C15 5 17 6 20 6"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M2 14C5 15 6 17 6 20"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DiamondFleuron({ className = '' }: { className?: string }) {
  return <span className={`text-[0.8em] text-[#cca046] select-none ${className}`}>✦</span>;
}
