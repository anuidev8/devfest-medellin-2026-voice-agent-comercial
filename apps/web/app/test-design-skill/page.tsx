'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TestDesignSkillPage() {
  const [agentState, setAgentState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'sales' | 'support' | 'reception'>('sales');
  const [audioLevel, setAudioLevel] = useState<number>(35);

  // Simulate audio level variations when speaking or listening
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (agentState !== 'idle') {
      interval = setInterval(() => {
        setAudioLevel(Math.floor(20 + Math.random() * 70));
      }, 120);
    } else {
      setAudioLevel(12);
    }
    return () => clearInterval(interval);
  }, [agentState]);

  const handleToggleMic = () => {
    if (isMicActive) {
      setIsMicActive(false);
      setAgentState('idle');
    } else {
      setIsMicActive(true);
      setAgentState('listening');
      // Simulate quick answer cycle for visual preview
      setTimeout(() => setAgentState('speaking'), 2800);
      setTimeout(() => setAgentState('idle'), 7500);
    }
  };

  return (
    <div className="min-h-screen bg-[#00041B] text-[#F0F4FD] font-sans selection:bg-[#376CF6] selection:text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#1342D2]/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#082096]/20 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-[#182C4A]/60 bg-[#00041B]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1342D2] to-[#376CF6] flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(55,108,246,0.5)]">
            V
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white">Commercial Voice AI</h1>
            <p className="text-xs text-[#728FC4]">Test Design Skill Console</p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-[#081524] border border-[#182C4A] p-1 rounded-full text-xs">
          {(['sales', 'support', 'reception'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-4 py-1.5 rounded-full capitalize transition-all duration-200 ${
                activeMode === mode
                  ? 'bg-[#376CF6] text-white shadow-[0_0_12px_rgba(55,108,246,0.4)]'
                  : 'text-[#728FC4] hover:text-[#F0F4FD]'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#081524] border border-[#182C4A] text-xs">
          <span className={`w-2 h-2 rounded-full ${isMicActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-[#728FC4] uppercase tracking-wider font-mono text-[10px]">
            {isMicActive ? 'Live WebSocket' : 'Standby'}
          </span>
        </div>
      </header>

      {/* Main Interactive Stage */}
      <main className="relative z-10 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1">
        {/* Left Column: Telemetry & Metrics Cards (Inspired by HRMS Design Ref) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#081524]/90 border border-[#182C4A] rounded-2xl p-5 hover:border-[#376CF6]/60 transition-all duration-300">
            <span className="text-xs uppercase tracking-wider text-[#728FC4] font-medium">Latency & Performance</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">184<span className="text-sm font-normal text-[#728FC4] ml-1">ms</span></span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">Ultra-Low</span>
            </div>
            <div className="w-full bg-[#182C4A]/50 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-[#376CF6] h-full w-[85%] rounded-full shadow-[0_0_8px_#376CF6]" />
            </div>
          </div>

          <div className="bg-[#081524]/90 border border-[#182C4A] rounded-2xl p-5 hover:border-[#376CF6]/60 transition-all duration-300">
            <span className="text-xs uppercase tracking-wider text-[#728FC4] font-medium">Synthesis Confidence</span>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl font-mono font-bold text-white tracking-tight">99.4<span className="text-sm font-normal text-[#728FC4] ml-1">%</span></span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#376CF6]/10 text-[#8284F9] border border-[#376CF6]/30 font-mono">Accurate</span>
            </div>
            <div className="text-xs text-[#728FC4] mt-2 flex items-center justify-between">
              <span>Model: Whisper + Gemini Live</span>
              <span className="font-mono text-white">48kHz</span>
            </div>
          </div>

          <div className="bg-[#081524]/90 border border-[#182C4A] rounded-2xl p-5 hover:border-[#376CF6]/60 transition-all duration-300">
            <span className="text-xs uppercase tracking-wider text-[#728FC4] font-medium">Session Sentiment</span>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xl font-semibold text-white">Positive · Ready</span>
              <span className="text-2xl">⚡️</span>
            </div>
            <p className="text-xs text-[#728FC4] mt-2">Active conversational intent tracking ready.</p>
          </div>
        </div>

        {/* Center Hero: Bioluminescent Audio Reactive Sphere (Inspired by Glowing Orb Ref) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center relative py-12">
          {/* Animated concentric rings */}
          <div className="relative flex items-center justify-center w-80 h-80 sm:w-96 sm:h-96">
            {/* Outer soft ambient pulse */}
            <div 
              className={`absolute inset-0 rounded-full transition-all duration-700 ${
                agentState === 'speaking' 
                  ? 'bg-gradient-to-tr from-[#082096]/60 via-[#1342D2]/40 to-[#8284F9]/50 blur-3xl scale-125' 
                  : agentState === 'listening' 
                  ? 'bg-gradient-to-tr from-[#38BDF8]/40 to-[#1342D2]/30 blur-2xl scale-110'
                  : 'bg-[#1342D2]/20 blur-2xl scale-100'
              }`}
            />

            {/* Ripple Wave Rings */}
            <div 
              className="absolute inset-2 rounded-full border border-[#376CF6]/30 animate-ping opacity-25"
              style={{ animationDuration: agentState === 'speaking' ? '1.5s' : '3.5s' }}
            />
            <div 
              className="absolute inset-8 rounded-full border border-[#8284F9]/40 transition-transform duration-500"
              style={{ transform: `scale(${1 + audioLevel / 400})` }}
            />

            {/* Core 3D Glowing Sphere */}
            <div 
              className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(55,108,246,0.6)] cursor-pointer transition-all duration-500 overflow-hidden"
              onClick={handleToggleMic}
              style={{
                background: 'radial-gradient(circle at 35% 30%, #8284F9 0%, #376CF6 25%, #082096 60%, #000427 100%)',
                transform: `scale(${1 + audioLevel / 500})`
              }}
            >
              {/* Internal Caustic light refraction */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/60 pointer-events-none rounded-full" />
              <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/20 rounded-full blur-xl pointer-events-none" />

              {/* Status Text on Center */}
              <div className="text-center relative z-10 select-none">
                <span className="text-xs uppercase tracking-widest text-white/80 font-mono block mb-1">
                  {agentState === 'idle' ? 'Click to Start' : agentState}
                </span>
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-md">
                  {agentState === 'idle' ? 'Ready' : agentState === 'listening' ? 'Listening...' : 'Responding'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Mic Toggle Action Bar */}
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleToggleMic}
              className={`flex items-center gap-3 px-6 py-3 rounded-full text-sm font-medium tracking-wide transition-all duration-300 shadow-lg ${
                isMicActive
                  ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                  : 'bg-[#376CF6] text-white hover:bg-[#2554d3] shadow-[0_0_25px_rgba(55,108,246,0.5)]'
              }`}
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
              <span>{isMicActive ? 'Mute Session' : 'Start Voice Test'}</span>
            </button>

            <button 
              onClick={() => {
                setAgentState(agentState === 'speaking' ? 'idle' : 'speaking');
              }}
              className="px-4 py-3 rounded-full bg-[#081524] border border-[#182C4A] text-xs text-[#728FC4] hover:text-white hover:border-[#376CF6] transition-colors"
            >
              Simulate Voice
            </button>
          </div>
        </div>

        {/* Right Column: Live Transcript Stream */}
        <div className="lg:col-span-3">
          <div className="bg-[#081524]/90 border border-[#182C4A] rounded-2xl p-5 flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-3 border-b border-[#182C4A]">
              <span className="text-xs uppercase tracking-wider text-[#728FC4] font-medium">Real-Time Transcript</span>
              <span className="w-2 h-2 rounded-full bg-[#376CF6] animate-ping" />
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
              <div className="bg-[#00041B]/60 border border-[#182C4A]/50 rounded-xl p-3">
                <div className="flex items-center justify-between text-[#728FC4] mb-1 font-mono text-[10px]">
                  <span>Customer (Sample)</span>
                  <span>10:24:12</span>
                </div>
                <p className="text-white/90">"Hello, I'd like to check my commercial delivery schedule for tomorrow."</p>
              </div>

              <div className="bg-[#182C4A]/30 border border-[#376CF6]/30 rounded-xl p-3">
                <div className="flex items-center justify-between text-[#8284F9] mb-1 font-mono text-[10px]">
                  <span>AI Agent (Live)</span>
                  <span>10:24:14</span>
                </div>
                <p className="text-[#F0F4FD]">"Certainly! Your shipment #B8820 is scheduled for delivery between 9:00 AM and 11:30 AM."</p>
              </div>

              {agentState === 'speaking' && (
                <div className="bg-[#182C4A]/50 border border-[#8284F9]/50 rounded-xl p-3 animate-pulse">
                  <div className="flex items-center justify-between text-[#8284F9] mb-1 font-mono text-[10px]">
                    <span>Synthesizing...</span>
                    <span>Streaming</span>
                  </div>
                  <p className="text-[#F0F4FD] italic">"Would you like me to send a WhatsApp notification reminder?"</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#182C4A] flex items-center justify-between text-[11px] text-[#728FC4]">
              <span>Audio VU Meter</span>
              <span className="font-mono text-white">{audioLevel}%</span>
            </div>
            <div className="w-full bg-[#00041B] h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#376CF6] to-[#8284F9] h-full transition-all duration-100 rounded-full" 
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer Navigation Bar */}
      <footer className="relative z-10 border-t border-[#182C4A]/60 bg-[#00041B]/80 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#728FC4]">
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-white transition-colors">
            ← Return to Dashboard
          </Link>
          <span>•</span>
          <a href="/design/moodboard.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-[#8284F9]">
            View Moodboard (HTML)
          </a>
          <span>•</span>
          <a href="/design/proposal.html" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors text-[#376CF6]">
            View Proposal (HTML)
          </a>
        </div>
        <div className="font-mono text-[11px] text-[#728FC4]/70">
          Generated via AI Design Framework v2
        </div>
      </footer>
    </div>
  );
}
