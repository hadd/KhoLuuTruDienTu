import * as React from 'react'

import { cn } from '@/lib/utils/cn'

interface TextBlockProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Number of lines to display before truncation (default: 1)
   * For single line, uses `truncate` class
   * For multiple lines, uses `line-clamp-{n}` utility
   */
  lines?: number
  /**
   * Maximum width constraint
   * Can be a number (treated as pixels) or a string (e.g., "200px", "50%", "10rem")
   */
  width?: string | number
  /**
   * HTML element to render (default: "div")
   */
  as?: keyof React.JSX.IntrinsicElements
  /**
   * Content to display
   */
  children: React.ReactNode
  /**
   * Custom tooltip text. If not provided, will extract text from children.
   * Set to empty string to disable tooltip.
   */
  tooltip?: string | null
}

/**
 * Extract plain text content from React children
 */
function extractTextContent(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children)
  }
  if (Array.isArray(children)) {
    return children.map(extractTextContent).join('')
  }
  if (React.isValidElement(children)) {
    const props = children.props as { children?: React.ReactNode }
    if (props.children) {
      return extractTextContent(props.children)
    }
  }
  return ''
}

/**
 * TextBlock - Component for handling text overflow with ellipsis
 *
 * This component provides consistent text truncation behavior with configurable
 * number of lines and optional width constraints. Defaults to single-line ellipsis.
 * Automatically shows tooltip on hover when content is truncated.
 *
 * @example
 * // Single line truncation (default)
 * <TextBlock>Long text that will be truncated</TextBlock>
 *
 * @example
 * // Multi-line truncation
 * <TextBlock lines={2}>Long text that will be truncated after 2 lines</TextBlock>
 *
 * @example
 * // With width constraint
 * <TextBlock width={200}>Text with max width of 200px</TextBlock>
 * <TextBlock width="50%">Text with max width of 50%</TextBlock>
 *
 * @example
 * // Custom element type
 * <TextBlock as="span" lines={1}>Inline truncated text</TextBlock>
 *
 * @example
 * // In table cells
 * <td>
 *   <TextBlock lines={1} className="font-semibold">
 *     {item.name}
 *   </TextBlock>
 * </td>
 *
 * @example
 * // Custom tooltip text
 * <TextBlock tooltip="Custom tooltip">Content</TextBlock>
 *
 * @example
 * // Disable tooltip
 * <TextBlock tooltip={null}>Content</TextBlock>
 */
export const TextBlock = React.forwardRef<HTMLElement, TextBlockProps>(
  (
    {
      lines = 1,
      width,
      as: Component = 'div',
      className,
      style,
      tooltip,
      children,
      ...props
    },
    ref,
  ) => {
    const internalRef = React.useRef<HTMLElement>(null)
    const [isTruncated, setIsTruncated] = React.useState(false)
    const [tooltipText, setTooltipText] = React.useState<string | undefined>(
      undefined,
    )

    // Combine refs
    const combinedRef = React.useCallback(
      (node: HTMLElement | null) => {
        internalRef.current = node
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      },
      [ref],
    )

    // Extract text content for tooltip
    const textContent = React.useMemo(() => {
      if (tooltip !== undefined) {
        return tooltip === null ? undefined : tooltip
      }
      const extracted = extractTextContent(children)
      return extracted || undefined
    }, [tooltip, children])

    // Check if content is truncated
    React.useEffect(() => {
      const element = internalRef.current
      if (!element || !textContent) {
        setIsTruncated(false)
        return
      }

      const checkTruncation = () => {
        // For single line, check horizontal overflow
        if (lines === 1) {
          const isOverflowing = element.scrollWidth > element.clientWidth
          setIsTruncated(isOverflowing)
        } else {
          // For multi-line, check vertical overflow
          const isOverflowing = element.scrollHeight > element.clientHeight
          setIsTruncated(isOverflowing)
        }
      }

      // Check immediately
      checkTruncation()

      // Check on resize
      const resizeObserver = new ResizeObserver(checkTruncation)
      resizeObserver.observe(element)

      return () => {
        resizeObserver.disconnect()
      }
    }, [lines, textContent, children])

    // Set tooltip text only when truncated
    React.useEffect(() => {
      setTooltipText(isTruncated && textContent ? textContent : undefined)
    }, [isTruncated, textContent])

    // Determine truncation class based on lines
    const truncationClass = lines === 1 ? 'truncate' : `line-clamp-${lines}`

    // Handle width constraint
    const widthStyle: React.CSSProperties = {
      ...style,
      ...(width && {
        maxWidth: typeof width === 'number' ? `${width}px` : width,
      }),
    }

    return React.createElement(
      Component,
      {
        ref: combinedRef,
        className: cn(truncationClass, className),
        style: widthStyle,
        title: tooltipText,
        ...props,
      },
      children,
    )
  },
)

TextBlock.displayName = 'TextBlock'
