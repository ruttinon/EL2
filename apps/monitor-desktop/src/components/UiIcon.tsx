import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';

export type UiIconSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<UiIconSize, number> = {
  sm: 16,
  md: 18,
  lg: 20,
};

export type UiIconProps = Omit<LucideProps, 'size'> & {
  icon: LucideIcon;
  size?: UiIconSize;
};

/** Consistent Lucide icons — stroke weight and size across Monitor UI. */
export function UiIcon({ icon: Icon, size = 'md', strokeWidth = 1.75, ...rest }: UiIconProps) {
  return <Icon size={SIZE_PX[size]} strokeWidth={strokeWidth} aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />;
}
