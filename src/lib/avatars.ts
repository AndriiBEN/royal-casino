/**
 * Preset avatars (original artwork: a Lucide glyph on a gradient medallion).
 * No uploads: nothing user-supplied is ever rendered as an image. Some presets unlock
 * with VIP tier; the server checks the tier before saving a choice.
 */
export type AvatarPreset = { id: string; label: string; icon: string; from: string; to: string; minLevel: number };

export const AVATARS: AvatarPreset[] = [
  { id: "crown", label: "Crown", icon: "crown", from: "#f3d98f", to: "#8a6424", minLevel: 1 },
  { id: "spade", label: "Ace of Spades", icon: "spade", from: "#3a3a44", to: "#0e0e12", minLevel: 1 },
  { id: "heart", label: "Queen of Hearts", icon: "heart", from: "#e05a6c", to: "#5a0e1c", minLevel: 1 },
  { id: "club", label: "Lucky Club", icon: "club", from: "#2f8f68", to: "#0b3324", minLevel: 1 },
  { id: "diamond", label: "Red Diamond", icon: "diamond", from: "#ff8a95", to: "#7a1424", minLevel: 1 },
  { id: "star", label: "Starlight", icon: "star", from: "#9fb6ff", to: "#26306b", minLevel: 1 },
  { id: "moon", label: "Midnight", icon: "moon", from: "#6c63b5", to: "#1a1640", minLevel: 1 },
  { id: "dice", label: "High Roller", icon: "dices", from: "#d9d2c0", to: "#5d5545", minLevel: 1 },
  { id: "flame", label: "Ember", icon: "flame", from: "#ffb067", to: "#8a2b0e", minLevel: 2 },
  { id: "feather", label: "Silver Quill", icon: "feather", from: "#eef1f5", to: "#7d8591", minLevel: 2 },
  { id: "castle", label: "Royal Keep", icon: "castle", from: "#f3d98f", to: "#5b3d12", minLevel: 3 },
  { id: "swords", label: "Duellist", icon: "swords", from: "#e7c77a", to: "#3b2a0e", minLevel: 3 },
  { id: "sun", label: "Platinum Sun", icon: "sun", from: "#e2f6fa", to: "#4f8796", minLevel: 4 },
  { id: "gem", label: "Diamond Heart", icon: "gem", from: "#ffffff", to: "#3aa7d9", minLevel: 5 },
];

export const DEFAULT_AVATAR = "crown";

export const avatarById = (id: string | null | undefined) => AVATARS.find((a) => a.id === id) ?? AVATARS[0];
