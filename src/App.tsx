/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Saturn } from './components/Saturn';
import { HandTracker } from './components/HandTracker';
import { Maximize, Minimize } from 'lucide-react';

export default function App() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      <Canvas camera={{ position: [0, 2, 6], fov: 60 }}>
        <color attach="background" args={['#050505']} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <Saturn />
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>

      <HandTracker />

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors border border-white/10 cursor-pointer"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
      </button>

      <div className="absolute top-4 left-4 z-50 text-white/80 pointer-events-none">
        <h1 className="text-2xl font-light tracking-widest uppercase mb-1">Saturn</h1>
        <p className="text-xs font-mono opacity-60">Interactive Particle System</p>
        <p className="text-xs font-mono opacity-60 mt-2">Open/close hand to control scale & chaos</p>
      </div>
    </div>
  );
}

