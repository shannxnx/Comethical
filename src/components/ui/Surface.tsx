import { View, type ViewProps } from 'react-native';

export interface SurfaceProps extends ViewProps {
  className?: string;
  padded?: boolean;
}

/** Rounded card surface used throughout the app. */
export function Surface({ className = '', padded = true, ...props }: SurfaceProps) {
  return <View {...props} className={`rounded-2xl border border-border bg-card ${padded ? 'p-4' : ''} ${className}`} />;
}
