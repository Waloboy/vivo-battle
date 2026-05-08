"use client";
import { Crosshair, Flame, Shield, CircleDot, Wind, Diamond, Crown, Satellite, Sparkles, Atom } from "lucide-react";

export const GIFT_CATALOG = [
  { key: "strike",    label: "Strike",     cost: 10,    icon: Crosshair,  color: "#a0f0a0", tier: 1 },
  { key: "flare",     label: "Flare",      cost: 50,    icon: Flame,      color: "#ff9f43", tier: 1 },
  { key: "shield",    label: "Shield",     cost: 200,   icon: Shield,     color: "#54a0ff", tier: 1 },
  { key: "neon_orb",  label: "Neon Orb",   cost: 500,   icon: CircleDot,  color: "#ff6b81", tier: 2 },
  { key: "vortex",    label: "Vortex",     cost: 1000,  icon: Wind,       color: "#a29bfe", tier: 2 },
  { key: "cyber_gem", label: "Cyber Gem",  cost: 2500,  icon: Diamond,    color: "#00d1ff", tier: 2 },
  { key: "dominion",  label: "Dominion",   cost: 5000,  icon: Crown,      color: "#ffd700", tier: 3 },
  { key: "satellite", label: "Satellite",  cost: 10000, icon: Satellite,  color: "#fd79a8", tier: 3 },
  { key: "hypernova", label: "Hypernova",  cost: 25000, icon: Sparkles,   color: "#e056fd", tier: 3 },
  { key: "genesis",   label: "VIVO SUPREME", cost: 50000, icon: Atom,     color: "#ff007a", tier: 3 },
] as const;

export type GiftKey = typeof GIFT_CATALOG[number]["key"];
