"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Zap, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
  lessonCount?: number;
  onStart?: () => void;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  onNodeClick?: (id: number) => void;
}

export default function RadialOrbitalTimeline({
  timelineData,
  onNodeClick,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [orbitRadius, setOrbitRadius] = useState<number>(200);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setIsMobile(w < 640);
      if (w < 480) setOrbitRadius(110);
      else if (w < 640) setOrbitRadius(140);
      else if (w < 768) setOrbitRadius(160);
      else setOrbitRadius(200);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState: Record<number, boolean> = {};
      Object.keys(prev).forEach((key) => { newState[parseInt(key)] = false; });
      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const currentItem = timelineData.find((item) => item.id === id);
        const newPulse: Record<number, boolean> = {};
        currentItem?.relatedIds.forEach((relId) => { newPulse[relId] = true; });
        setPulseEffect(newPulse);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }
      return newState;
    });
  };

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
    }, 50);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = orbitRadius * Math.cos(radian);
    const y = orbitRadius * Math.sin(radian);
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, angle, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const activeItem = timelineData.find((i) => i.id === activeNodeId);
    return activeItem?.relatedIds.includes(itemId) ?? false;
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed": return "text-white bg-black border-white";
      case "in-progress": return "text-black bg-white border-black";
      case "pending": return "text-white bg-black/40 border-white/50";
      default: return "text-white bg-black/40 border-white/50";
    }
  };

  const statusLabel = { completed: "IMEKAMILIKA", "in-progress": "INAENDELEA", pending: "INASUBIRI" };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{ perspective: "1000px" }}
        >
          {/* Center orb */}
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 via-red-500 to-orange-700 animate-pulse flex items-center justify-center z-10 pointer-events-none">
            <div className="absolute w-20 h-20 rounded-full border border-orange-400/30 animate-ping opacity-60" />
            <div className="absolute w-24 h-24 rounded-full border border-orange-400/20 animate-ping opacity-40" style={{ animationDelay: "0.5s" }} />
            <BookOpen size={20} className="text-white z-10" />
          </div>

          {/* Orbit ring */}
          <div
            className="absolute rounded-full border border-white/10 pointer-events-none"
            style={{ width: orbitRadius * 2, height: orbitRadius * 2 }}
          />

          {/* Nodes */}
          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                ref={(el) => { nodeRefs.current[item.id] = el; }}
                className="absolute transition-all duration-700 cursor-pointer"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isExpanded ? 200 : position.zIndex,
                  opacity: isExpanded ? 1 : position.opacity,
                }}
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              >
                {/* Energy halo */}
                <div
                  className={`absolute rounded-full ${isPulsing ? "animate-pulse" : ""}`}
                  style={{
                    background: "radial-gradient(circle, rgba(234,88,12,0.25) 0%, rgba(234,88,12,0) 70%)",
                    width: `${item.energy * 0.4 + 40}px`,
                    height: `${item.energy * 0.4 + 40}px`,
                    left: `-${(item.energy * 0.4 + 40 - 40) / 2}px`,
                    top: `-${(item.energy * 0.4 + 40 - 40) / 2}px`,
                  }}
                />

                {/* Node circle */}
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isExpanded ? "bg-orange-500 border-orange-400 shadow-lg shadow-orange-500/40 scale-150 text-white"
                    : isRelated ? "bg-orange-500/30 border-orange-400 animate-pulse text-orange-300"
                    : "bg-black border-white/40 text-white hover:border-orange-400/60"}
                `}>
                  <Icon size={16} />
                </div>

                {/* Label */}
                <div className={`
                  absolute whitespace-nowrap text-xs font-semibold tracking-wide transition-all duration-300
                  ${isMobile ? "top-11 -translate-x-1/2 left-1/2" : "top-12"}
                  ${isExpanded ? "text-orange-400 scale-110" : "text-white/70"}
                `}
                  style={{ left: isMobile ? "50%" : undefined, transform: isMobile ? "translateX(-50%)" : undefined }}
                >
                  {item.title.length > 14 ? item.title.slice(0, 13) + "…" : item.title}
                </div>

                {/* Expanded card */}
                {isExpanded && (
                  <Card className={`
                    absolute bg-black/95 backdrop-blur-xl border-orange-500/30 shadow-2xl shadow-orange-500/10 overflow-visible
                    ${isMobile
                      ? "w-56 -translate-x-1/2 left-1/2 top-16"
                      : "w-64 -translate-x-1/2 left-1/2 top-20"}
                  `}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-orange-500/50" />
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex justify-between items-center">
                        <Badge className={`px-2 text-[10px] ${getStatusStyles(item.status)}`}>
                          {statusLabel[item.status]}
                        </Badge>
                        <span className="text-[10px] font-mono text-white/40">{item.date}</span>
                      </div>
                      <CardTitle className="text-sm mt-1 text-white leading-tight">{item.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-white/70 px-4 pb-4">
                      <p className="line-clamp-3">{item.content}</p>

                      {/* Energy bar */}
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex justify-between items-center text-[10px] mb-1 text-white/50">
                          <span className="flex items-center gap-1"><Zap size={9} /> Maudhui</span>
                          <span className="font-mono">{item.lessonCount ?? 0} masomo</span>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${item.energy}%` }} />
                        </div>
                      </div>

                      {/* Start button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onNodeClick?.(item.id); }}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                      >
                        Anza Kujifunza <ArrowRight size={12} />
                      </button>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
