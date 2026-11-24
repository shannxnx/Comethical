import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Accepts arbitrary strings (e.g. category icons from the database) and falls back safely. */
export function toIconName(name: string | undefined, fallback: IconName = 'help-circle'): IconName {
  return name && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name) ? (name as IconName) : fallback;
}

export function Icon({ name, size = 20, color }: { name: IconName | string; size?: number; color: string }) {
  return <Ionicons name={toIconName(name)} size={size} color={color} />;
}
