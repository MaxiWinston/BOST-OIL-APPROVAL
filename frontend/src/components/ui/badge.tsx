import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-transparent px-2 py-0.5 text-xs font-mono font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-2!",
  {
    variants: {
      variant: {
        default: "bg-surface-container text-on-surface border-outline",
        secondary:
          "bg-primary-container text-on-primary-container border-primary-container/50",
        destructive:
          "bg-error-container text-on-error-container border-error/50 focus-visible:ring-error/20",
        success:
          "bg-green-100 text-green-800 border-green-200",
        warning:
          "bg-yellow-100 text-yellow-800 border-yellow-200",
        info:
          "bg-blue-100 text-blue-800 border-blue-200",
        outline:
          "border-outline text-on-surface bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
