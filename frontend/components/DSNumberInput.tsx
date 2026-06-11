import React from 'react'
import { inputVariants } from '@/lib/component-variants'
import { cn } from '@/lib/utils'

type DSNumberInputProps = {
  className?: string
  value?: number
  onValueChange?: (value: number | null) => void
  placeholder?: string
  ariaLabel?: string
  min?: number
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  size?: 'sm' | 'default' | 'lg'
}

export function DSNumberInput({
  className,
  value,
  onValueChange,
  placeholder,
  ariaLabel,
  min,
  icon: Icon,
  size = 'default',
}: DSNumberInputProps) {
  const base = inputVariants({ size })
  const hasIcon = !!Icon

  return (
    <div className="relative">
      {hasIcon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') onValueChange?.(null)
          else onValueChange?.(Number(v))
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        min={min}
        className={cn(base, hasIcon && 'pl-9', className)}
      />
    </div>
  )}

export default DSNumberInput

