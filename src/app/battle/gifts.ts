"use client";
import { Zap, Activity, Shield, Sparkles, Star, Gem, Crown, History, Trophy, Infinity as InfinityIcon } from "lucide-react";

export const GIFT_CATALOG = [
  { key: "impacto",   label: "Impacto",    cost: 10,    icon: Zap,          color: "#00d1ff", tier: 1 },
  { key: "pulso",     label: "Pulso",      cost: 20,    icon: Activity,     color: "#a0f0a0", tier: 1 },
  { key: "escudo",    label: "Escudo",     cost: 50,    icon: Shield,       color: "#54a0ff", tier: 1 },
  { key: "nova",      label: "Nova",       cost: 100,   icon: Sparkles,     color: "#ff9f43", tier: 2 },
  { key: "estelar",   label: "Estelar",    cost: 200,   icon: Star,         color: "#ffd700", tier: 2 },
  { key: "magno",     label: "Magno",      cost: 500,   icon: Gem,          color: "#ff6b81", tier: 2 },
  // Elite Gifts
  { key: "dominio",   label: "Dominio",    cost: 1000,  icon: Crown,        color: "#e056fd", tier: 3 },
  { key: "legado",    label: "Legado",     cost: 2000,  icon: History,      color: "#a29bfe", tier: 3 },
  { key: "gloria",    label: "Gloria",     cost: 5000,  icon: Trophy,       color: "#ffd700", tier: 3 },
  { key: "infinito",  label: "Infinito",   cost: 10000, icon: InfinityIcon, color: "#ff007a", tier: 3 },
] as const;

export type GiftKey = typeof GIFT_CATALOG[number]["key"];
