'use client';

import { useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';

interface MapCanvasProps {
  stages: any[];
  clearedStages: string[];
  onSelectStage: (id: string) => void;
  selectedStageId: string | null;
}

export default function MapCanvas({ stages, clearedStages, onSelectStage, selectedStageId }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const mountedRef = useRef(true);

  // Is unlocked logic
  const isUnlocked = useCallback((stageId: string) => {
    if (stageId === '1-1') return true;
    if (stageId === '1-2') return clearedStages.includes('1-1');
    if (stageId === 'boss-1') return clearedStages.includes('1-2');
    return false;
  }, [clearedStages]);

  useEffect(() => {
    mountedRef.current = true;
    if (!canvasRef.current || !containerRef.current) return;

    let resizeObserver: ResizeObserver | null = null;

    const initPixi = async () => {
      const app = new PIXI.Application();
      try {
        const container = containerRef.current;
        if (!container) return;

        let initialWidth = container.clientWidth || 800;
        let initialHeight = container.clientHeight || 600;

        await app.init({
          width: initialWidth,
          height: initialHeight,
          backgroundColor: 0x050505, 
          antialias: true, 
          resolution: window.devicePixelRatio || 1, 
          autoDensity: true
        });
        
        if (!mountedRef.current) { 
          app.destroy(true, { children: true }); 
          return; 
        }
        
        appRef.current = app;
        (window as any).__PIXI_APP__ = app;
        console.log("[DEBUG] MapCanvas rendering with stages:", stages);

        if (canvasRef.current) {
          canvasRef.current.innerHTML = '';
          app.canvas.style.width = '100%';
          app.canvas.style.height = '100%';
          canvasRef.current.appendChild(app.canvas);
        }

        // Map Container (Draggable)
        const mapContainer = new PIXI.Container();
        mapContainer.eventMode = 'static';
        
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let containerStart = { x: 0, y: 0 };

        mapContainer.on('pointerdown', (e) => {
          isDragging = true;
          dragStart = { x: e.global.x, y: e.global.y };
          containerStart = { x: mapContainer.x, y: mapContainer.y };
        });

        app.stage.on('pointerup', () => { isDragging = false; });
        app.stage.on('pointerupoutside', () => { isDragging = false; });
        app.stage.on('pointermove', (e) => {
          if (isDragging) {
            const dx = e.global.x - dragStart.x;
            const dy = e.global.y - dragStart.y;
            // Limit scrolling bounds
            let newX = containerStart.x + dx;
            let newY = containerStart.y + dy;
            
            const limitX = 1000;
            const limitY = 1000;
            if (newX > limitX) newX = limitX;
            if (newX < -limitX) newX = -limitX;
            if (newY > limitY) newY = limitY;
            if (newY < -limitY) newY = -limitY;

            mapContainer.x = newX;
            mapContainer.y = newY;
          }
        });

        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);
        app.stage.addChild(mapContainer);

        // Add Zoom capabilities
        const zoomSpeed = 0.1;
        app.canvas.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault();
          const zoomDirection = e.deltaY > 0 ? -1 : 1;
          let newScale = mapContainer.scale.x + zoomDirection * zoomSpeed;
          newScale = Math.max(0.3, Math.min(newScale, 3)); // Clamp zoom between 0.3x and 3x
          mapContainer.scale.set(newScale);
        });

        // Simple pinch to zoom (touch)
        let initialPinchDistance: number | null = null;
        let initialScale = 1;

        app.canvas.addEventListener('touchstart', (e: TouchEvent) => {
          if (e.touches.length === 2) {
            initialPinchDistance = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            initialScale = mapContainer.scale.x;
          }
        });

        app.canvas.addEventListener('touchmove', (e: TouchEvent) => {
          if (e.touches.length === 2 && initialPinchDistance !== null) {
            e.preventDefault();
            const currentDistance = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const scaleChange = currentDistance / initialPinchDistance;
            let newScale = initialScale * scaleChange;
            newScale = Math.max(0.3, Math.min(newScale, 3));
            mapContainer.scale.set(newScale);
          }
        });

        app.canvas.addEventListener('touchend', (e: TouchEvent) => {
          if (e.touches.length < 2) {
            initialPinchDistance = null;
          }
        });

        // Background container to hold map and grid (added at index 0)
        const bgLayer = new PIXI.Container();
        mapContainer.addChildAt(bgLayer, 0);

        // Async load map texture
        PIXI.Assets.load('/images/world_map_v2.png').then((texture) => {
          if (!mountedRef.current) return;
          const mapSprite = new PIXI.Sprite(texture);
          mapSprite.anchor.set(0.5);
          // Assuming map is large, center it at 0,0 relative to mapContainer
          mapSprite.x = 0;
          mapSprite.y = 0;
          bgLayer.addChildAt(mapSprite, 0);
        }).catch((e) => {
          console.warn('Failed to load map image, using fallback.', e);
          const bgGraphics = new PIXI.Graphics();
          bgGraphics.rect(-2000, -2000, 4000, 4000);
          bgGraphics.fill({ color: 0x2A201A });
          bgLayer.addChildAt(bgGraphics, 0);
        });

        // Draw grid lines
        const grid = new PIXI.Graphics();
        for(let i = -2000; i <= 2000; i += 100) {
          grid.moveTo(i, -2000).lineTo(i, 2000).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
          grid.moveTo(-2000, i).lineTo(2000, i).stroke({ width: 1, color: 0x000000, alpha: 0.3 });
        }
        bgLayer.addChild(grid);

        // Center map container to screen initially
        mapContainer.x = initialWidth / 2;
        mapContainer.y = initialHeight / 2;

        // Node Positions (Relative to map center 0,0)
        const positions: Record<string, {x: number, y: number}> = {};
        stages.forEach(stage => {
          if (stage.position) {
            positions[stage.id] = stage.position;
          }
        });

        // Draw connections
        const lines = new PIXI.Graphics();
        mapContainer.addChild(lines);

        const area1Stages = stages.filter(s => s.area === 1);
        
        area1Stages.forEach((stage, i) => {
          const unlocked = isUnlocked(stage.id);
          const nextStage = area1Stages[i+1];
          if (nextStage && isUnlocked(nextStage.id)) {
            const p1 = positions[stage.id];
            const p2 = positions[nextStage.id];
            if (p1 && p2) {
              lines.moveTo(p1.x, p1.y);
              lines.lineTo(p2.x, p2.y);
              lines.stroke({ width: 4, color: 0x111111, alpha: 0.8 }); // Chains/Paths
              lines.moveTo(p1.x, p1.y);
              lines.lineTo(p2.x, p2.y);
              lines.stroke({ width: 1, color: 0x888888, alpha: 0.5 });
            }
          }
        });

        // Add Nodes
        const nodes: Record<string, PIXI.Graphics> = {};
        
        area1Stages.forEach((stage) => {
          const pos = positions[stage.id];
          if (!pos) return;

          const unlocked = isUnlocked(stage.id);
          const cleared = clearedStages.includes(stage.id);
          const isBoss = stage.isAreaBoss;
          const isActive = unlocked && !cleared;

          const nodeGroup = new PIXI.Container();
          nodeGroup.x = pos.x;
          nodeGroup.y = pos.y;
          mapContainer.addChild(nodeGroup);

          // Purple Effect for active node
          if (isActive) {
            // Magical aura
            const aura = new PIXI.Graphics();
            aura.circle(0, 0, isBoss ? 55 : 45);
            aura.fill({ color: 0xBC00FB, alpha: 0.15 });
            nodeGroup.addChild(aura);

            // Particles
            const particles = new PIXI.Graphics();
            nodeGroup.addChild(particles);

            let time = 0;
            app.ticker.add((ticker) => {
              time += 0.05 * ticker.deltaTime;
              
              // Pulsing aura
              aura.scale.set(1 + Math.sin(time * 0.5) * 0.15);
              aura.alpha = 0.15 + Math.abs(Math.sin(time)) * 0.1;

              // Orbiting magical particles
              particles.clear();
              for(let i=0; i<3; i++) {
                const angle = time * 0.5 + (Math.PI * 2 / 3) * i;
                const radius = (isBoss ? 45 : 35) + Math.sin(time * 2 + i) * 5;
                particles.circle(Math.cos(angle) * radius, Math.sin(angle) * radius, 3);
                particles.fill({ color: 0xBC00FB, alpha: 0.8 });
              }
            });
          }

          // Node Background
          const node = new PIXI.Graphics();
          node.eventMode = unlocked ? 'static' : 'none';
          node.cursor = unlocked ? 'pointer' : 'default';
          
          const drawNode = (selected: boolean) => {
            node.clear();
            const size = isBoss ? 30 : 20;
            
            if (!unlocked) {
              node.rect(-size, -size, size*2, size*2);
              node.fill({ color: 0x1A1A1A, alpha: 0.4 });
              node.stroke({ width: 2, color: 0x2C2C2C, alpha: 0.5 });
            } else if (cleared) {
              node.circle(0, 0, size);
              node.fill({ color: 0x00FFAB, alpha: 0.2 });
              node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0x00FFAB });
            } else if (isBoss) {
              node.moveTo(0, -size-5).lineTo(size+5, 0).lineTo(0, size+5).lineTo(-size-5, 0).closePath();
              node.fill({ color: 0xFF6B9B, alpha: selected ? 0.6 : 0.3 });
              node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0xFF6B9B });
            } else {
              node.circle(0, 0, size);
              node.fill({ color: 0xBC00FB, alpha: selected ? 0.6 : 0.3 });
              node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0xBC00FB });
            }
          };

          drawNode(selectedStageId === stage.id);
          nodes[stage.id] = node;
          
          node.on('pointerdown', (e) => {
            e.stopPropagation(); // prevent drag
            onSelectStage(stage.id);
          });
          
          nodeGroup.addChild(node);

          // Node Label
          const text = new PIXI.Text({
            text: stage.id,
            style: {
              fontFamily: 'monospace',
              fontSize: 10,
              fill: unlocked ? 0xFFFFFF : 0x666666,
              fontWeight: 'bold',
            }
          });
          text.anchor.set(0.5);
          text.y = isBoss ? 45 : 35;
          nodeGroup.addChild(text);
        });

        // Store update function to react to state changes without recreating app
        (appRef.current as any).updateSelection = (newSelectedId: string | null) => {
          area1Stages.forEach(stage => {
            const node = nodes[stage.id];
            if (node) {
              const unlocked = isUnlocked(stage.id);
              const cleared = clearedStages.includes(stage.id);
              const isBoss = stage.isAreaBoss;
              const selected = newSelectedId === stage.id;
              
              node.clear();
              const size = isBoss ? 30 : 20;
              
              if (!unlocked) {
                node.rect(-size, -size, size*2, size*2);
                node.fill({ color: 0x1A1A1A, alpha: 0.4 });
                node.stroke({ width: 2, color: 0x2C2C2C, alpha: 0.5 });
              } else if (cleared) {
                node.circle(0, 0, size);
                node.fill({ color: 0x00FFAB, alpha: 0.2 });
                node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0x00FFAB });
              } else if (isBoss) {
                node.moveTo(0, -size-5).lineTo(size+5, 0).lineTo(0, size+5).lineTo(-size-5, 0).closePath();
                node.fill({ color: 0xFF6B9B, alpha: selected ? 0.6 : 0.3 });
                node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0xFF6B9B });
              } else {
                node.circle(0, 0, size);
                node.fill({ color: 0xBC00FB, alpha: selected ? 0.6 : 0.3 });
                node.stroke({ width: selected ? 4 : 2, color: selected ? 0xFFFFFF : 0xBC00FB });
              }
            }
          });
        };

        // Setup ResizeObserver
        resizeObserver = new ResizeObserver((entries) => {
          if (!appRef.current || !mountedRef.current) return;
          for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              appRef.current.renderer.resize(width, height);
              // recenter on resize so it doesn't get pushed into oblivion if started at 0x0
              if (mapContainer.x === 0 || mapContainer.y === 0 || (initialWidth === 0)) {
                mapContainer.x = width / 2;
                mapContainer.y = height / 2;
                initialWidth = width;
                initialHeight = height;
              }
            }
          }
        });
        resizeObserver.observe(container);

      } catch (e) { console.error("MapCanvas init error:", e); }
    };

    initPixi();
    return () => {
      mountedRef.current = false;
      if (resizeObserver) resizeObserver.disconnect();
      if (appRef.current) { 
        appRef.current.destroy(true, { children: true }); 
        appRef.current = null; 
      }
    };
  }, [stages, clearedStages, isUnlocked, onSelectStage]);

  // Update selection visually
  useEffect(() => {
    if (appRef.current && (appRef.current as any).updateSelection) {
      (appRef.current as any).updateSelection(selectedStageId);
    }
  }, [selectedStageId]);

  return (
    <div ref={containerRef} className="absolute inset-0 bg-[#050505] overflow-hidden" style={{ width: '100%', height: '100%' }}>
      <div ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ width: '100%', height: '100%' }} />
      
      {/* Vignette Overlay for eroded feel */}
      <div className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, #050505 100%)',
          boxShadow: 'inset 0 0 100px rgba(0,0,0,1)'
        }}
      />
    </div>
  );
}
