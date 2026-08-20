import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded border border-outline bg-surface-container-lowest px-2.5 py-1 text-xs transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground placeholder:text-on-surface-variant focus-visible:border-secondary-container focus-visible:border-2 focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-container disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-1 aria-invalid:ring-error/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
