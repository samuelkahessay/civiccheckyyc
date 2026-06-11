import React from 'react'
import { getButtonClasses } from '@/lib/component-variants'
import { cn } from '@/lib/utils'

type DSButtonProps = {
  children?: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  // Map size 'xs' to 'sm' to maintain existing call sites
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  fullWidth?: boolean
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

export function DSButton({
  children,
  className,
  type = 'button',
  onClick,
  disabled,
  size = 'default',
  variant = 'primary',
  fullWidth = false,
  icon: Icon,
}: DSButtonProps) {
  const mappedSize = size === 'xs' ? 'sm' : size
  const classes = getButtonClasses({ variant, size: mappedSize as any, fullWidth, className })

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cn(classes)}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}

export default DSButton

