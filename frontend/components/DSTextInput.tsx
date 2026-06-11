import React from 'react'
import { inputVariants } from '@/lib/component-variants'
import { cn } from '@/lib/utils'

type DSTextInputProps = {
  className?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  ariaLabel?: string
  ariaDescribedBy?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  size?: 'sm' | 'default' | 'lg'
}

export function DSTextInput({
  className,
  value,
  onChange,
  placeholder,
  ariaLabel,
  ariaDescribedBy,
  icon: Icon,
  size = 'default',
}: DSTextInputProps) {
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
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn(base, hasIcon && 'pl-9', className)}
      />
    </div>
  )
}

export default DSTextInput

