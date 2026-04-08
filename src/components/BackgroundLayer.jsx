import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BackgroundLayer() {
  const mountRef = useRef(null);

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    if (mountRef.current) {
        mountRef.current.appendChild(renderer.domElement);
    }

    const geometry = new THREE.PlaneGeometry(2, 2);
    
    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        varying vec2 vUv;

        float smoothNoise( vec2 x ) {
            vec2 p = floor(x);
            vec2 f = fract(x);
            f = f*f*(3.0-2.0*f);
            float n = p.x + p.y*57.0;
            return mix(mix( fract(sin(n)*43758.5453),      fract(sin(n+1.0)*43758.5453),f.x),
                       mix( fract(sin(n+57.0)*43758.5453), fract(sin(n+58.0)*43758.5453),f.x),f.y);
        }

        void main() {
            vec2 st = gl_FragCoord.xy/u_resolution.xy;
            st.x *= u_resolution.x/u_resolution.y;

            // Fluid swirl simulation
            vec2 q = vec2(0.);
            q.x = smoothNoise(st + 0.05 * u_time);
            q.y = smoothNoise(st + vec2(1.0));

            vec2 r = vec2(0.);
            r.x = smoothNoise(st + 1.0 * q + vec2(1.7,9.2)+ 0.15 * u_time);
            r.y = smoothNoise(st + 1.0 * q + vec2(8.3,2.8)+ 0.126 * u_time);

            float f = smoothNoise(st + r);

            // Modern Light Theme Colors
            vec3 color1 = vec3(0.88, 0.93, 1.0); // Soft cool blue
            vec3 color2 = vec3(0.96, 0.88, 1.0); // Soft purple
            vec3 color3 = vec3(0.85, 0.97, 0.95); // Soft teal
            vec3 colorBase = vec3(0.98, 0.99, 1.0); 

            vec3 color = mix(colorBase, color1, clamp(f*f*3.0,0.0,1.0));
            color = mix(color, color2, clamp(length(q),0.0,1.0));
            color = mix(color, color3, clamp(length(r.x),0.0,1.0));

            gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationFrameId;
    const clock = new THREE.Clock();

    const render = () => {
      material.uniforms.u_time.value = clock.getElapsedTime() * 0.3; // Speed
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="canvas-container" />;
}
