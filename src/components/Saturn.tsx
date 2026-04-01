import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store';

const vertexShader = `
uniform float uTime;
uniform float uScale;

attribute float aType; // 0: core, 1: ring
attribute float aRadius;
attribute float aSpeed;
attribute vec3 aRandomDir;
attribute vec3 aColor;

varying vec3 vColor;
varying float vBrightness;

void main() {
    vec3 pos = position;
    
    // Kepler rotation
    float angle = uTime * aSpeed;
    float c = cos(angle);
    float s = sin(angle);
    mat2 rot = mat2(c, -s, s, c);
    
    // Rotate around Y axis
    pos.xz = rot * pos.xz;
    
    // Apply scale
    pos *= uScale;
    
    // Chaos when scale is large
    // Normal scale is ~1.0. Max scale is 5.0.
    // Chaos starts at scale 3.0, max at 5.0.
    float chaosFactor = smoothstep(3.0, 5.0, uScale);
    if (chaosFactor > 0.0) {
        // Radial explosion
        pos += normalize(pos) * chaosFactor * uScale * 2.0 * aRandomDir.x;
        
        // High frequency noise (flies buzzing)
        vec3 noise;
        noise.x = sin(uTime * 30.0 + aRandomDir.x * 100.0);
        noise.y = cos(uTime * 32.0 + aRandomDir.y * 100.0);
        noise.z = sin(uTime * 28.0 + aRandomDir.z * 100.0);
        pos += noise * chaosFactor * uScale * 1.5;
    }
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    
    // Size attenuation
    float baseSize = aType == 0.0 ? 3.0 : 1.5;
    gl_PointSize = baseSize * (1.0 / -mvPosition.z) * uScale;
    
    // Brightness: physical lighting law (inverse square, inverted for scale)
    // Small dark, large bright.
    float brightness = (uScale * uScale) / 10.0 + 0.2;
    vBrightness = brightness;
    vColor = aColor;
}
`;

const fragmentShader = `
varying vec3 vColor;
varying float vBrightness;

void main() {
    // Circular particle
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    
    // Soft edge
    float alpha = smoothstep(0.5, 0.2, dist);
    
    gl_FragColor = vec4(vColor * vBrightness, alpha);
}
`;

export function Saturn() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const currentScale = useRef(1.0);
  const currentPosition = useRef(new THREE.Vector2(0, 0));

  const particlesCount = 300000;
  const coreCount = 100000;
  const ringCount = 200000;

  const [positions, types, radii, speeds, randomDirs, colors] = useMemo(() => {
    const positions = new Float32Array(particlesCount * 3);
    const types = new Float32Array(particlesCount);
    const radii = new Float32Array(particlesCount);
    const speeds = new Float32Array(particlesCount);
    const randomDirs = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);

    const colorCore = new THREE.Color('#f4d03f');
    const colorCoreAlt = new THREE.Color('#d35400');

    // Core
    for (let i = 0; i < coreCount; i++) {
      const r = Math.cbrt(Math.random()) * 1.0;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      types[i] = 0.0;
      radii[i] = r;
      // Core rotates slowly
      speeds[i] = 0.2;

      randomDirs[i * 3] = Math.random() * 2 - 1;
      randomDirs[i * 3 + 1] = Math.random() * 2 - 1;
      randomDirs[i * 3 + 2] = Math.random() * 2 - 1;

      // Add some variation to core color
      const c = colorCore.clone().lerp(colorCoreAlt, Math.random());
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    // Rings
    for (let i = coreCount; i < particlesCount; i++) {
      let r = 0;
      let valid = false;
      while (!valid) {
        r = 1.2 + Math.random() * 2.8; // 1.2 to 4.0
        // Cassini division
        if (r > 2.0 && r < 2.2) {
          if (Math.random() > 0.95) valid = true; // sparse
        } else {
          valid = true;
        }
      }

      const theta = Math.random() * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const y = (Math.random() - 0.5) * 0.05; // thin disk
      const z = r * Math.sin(theta);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      types[i] = 1.0;
      radii[i] = r;
      // Kepler's law: v ~ 1/sqrt(r) -> w ~ 1/r^1.5
      speeds[i] = 1.0 / Math.pow(r, 1.5);

      randomDirs[i * 3] = Math.random() * 2 - 1;
      randomDirs[i * 3 + 1] = Math.random() * 2 - 1;
      randomDirs[i * 3 + 2] = Math.random() * 2 - 1;

      let c = new THREE.Color();
      if (r < 1.8) c.set('#d4c4a8');
      else if (r < 2.0) c.set('#e6d8c3');
      else if (r < 2.5) c.set('#b5a68c');
      else c.set('#8c7c62');

      // Add noise to ring color
      c.lerp(new THREE.Color('#ffffff'), Math.random() * 0.2);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    return [positions, types, radii, speeds, randomDirs, colors];
  }, []);

  useFrame((state, delta) => {
    const targetScale = useAppStore.getState().targetScale;
    const targetPosition = useAppStore.getState().targetPosition;

    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      
      // Smoothly interpolate scale
      currentScale.current = THREE.MathUtils.lerp(currentScale.current, targetScale, delta * 5.0);
      materialRef.current.uniforms.uScale.value = currentScale.current;
    }

    if (pointsRef.current) {
      currentPosition.current.lerp(new THREE.Vector2(targetPosition[0], targetPosition[1]), delta * 5.0);

      // Move in camera space so it perfectly tracks the screen even if OrbitControls is rotating the camera
      const camera = state.camera;
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      const newPos = new THREE.Vector3()
        .addScaledVector(right, currentPosition.current.x)
        .addScaledVector(up, currentPosition.current.y);

      pointsRef.current.position.copy(newPos);
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particlesCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-aType" count={particlesCount} array={types} itemSize={1} />
        <bufferAttribute attach="attributes-aRadius" count={particlesCount} array={radii} itemSize={1} />
        <bufferAttribute attach="attributes-aSpeed" count={particlesCount} array={speeds} itemSize={1} />
        <bufferAttribute attach="attributes-aRandomDir" count={particlesCount} array={randomDirs} itemSize={3} />
        <bufferAttribute attach="attributes-aColor" count={particlesCount} array={colors} itemSize={3} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uScale: { value: 1.0 },
        }}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
