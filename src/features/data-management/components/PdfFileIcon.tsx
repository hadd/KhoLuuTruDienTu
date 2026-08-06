import { forwardRef, type SVGProps } from 'react'

/** PDF document glyph with red badge — scales cleanly at tree icon size. */
export const PdfFileIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(
  function PdfFileIcon({ className, ...props }, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden
        {...props}
      >
        <path
          d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-6Z"
          fill="currentColor"
          fillOpacity="0.12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v5a1 1 0 0 0 1 1h5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="4" y="13" width="16" height="7" rx="1.25" fill="currentColor" />
        {/* P */}
        <path
          d="M6.15 18.6V14.4h1.55c.95 0 1.5.48 1.5 1.18 0 .7-.55 1.18-1.5 1.18H7.1v1.84H6.15Zm.95-2.55h.52c.38 0 .62-.2.62-.5s-.24-.5-.62-.5h-.52v1Z"
          fill="white"
        />
        {/* D */}
        <path
          d="M10.2 18.6V14.4h1.45c1.2 0 1.95.72 1.95 2.1 0 1.38-.75 2.1-1.95 2.1H10.2Zm.95-.72h.48c.7 0 1.05-.42 1.05-1.38 0-.96-.35-1.38-1.05-1.38h-.48v2.76Z"
          fill="white"
        />
        {/* F */}
        <path
          d="M15.35 18.6V14.4h2.55v.72h-1.6v1.2h1.45v.7h-1.45v1.58h-.95Z"
          fill="white"
        />
      </svg>
    )
  },
)
