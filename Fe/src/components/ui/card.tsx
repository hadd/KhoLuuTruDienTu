import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Card variant configuration using class-variance-authority
 * Provides consistent card styling across the application
 */
const cardVariants = cva(' border bg-card text-card-foreground shadow-sm', {
  variants: {
    variant: {
      default: 'rounded-md',
      list: 'p-0 rounded-md', // Minimal padding for list items
      detail: 'p-6', // More padding for detail views
      hover: 'transition-colors hover:bg-accent',
      interactive:
        'rounded-md border-border transition-colors hover:bg-accent cursor-pointer',
      bordered: 'rounded-md border-2',
      'main-list': 'p-0 border-none', // Main list card of content area (no padding, no border)
      reset: 'p-0 border-none rounded-none shadow-none', // Reset card styles
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

/**
 * CardVariant type for type-safe variant usage
 */
export type CardVariant = VariantProps<typeof cardVariants>['variant']

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

/**
 * Card - Container component with standardized variants
 *
 * This component provides consistent card styling with semantic variants.
 * Use appropriate variants based on context (list items, detail views, interactive cards, etc.)
 *
 * @example
 * // ✅ Correct - Use variants
 * <Card variant="interactive">Clickable card</Card>
 * <Card variant="list">List item</Card>
 * <Card variant="detail">Detail view</Card>
 *
 * @example
 * // ✅ Correct - Default variant (standard card)
 * <Card>Standard card</Card>
 *
 * @example
 * // ❌ Wrong - Don't replicate card styles
 * <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
 *   Content
 * </div>
 *
 * @example
 * // ✅ Correct - Variant with className override (for edge cases)
 * <Card variant="interactive" className="custom-class">
 *   Content
 * </Card>
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 px-4 py-3', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

const CardAction = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('ml-auto', className)} {...props} />
))
CardAction.displayName = 'CardAction'

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  cardVariants,
}
