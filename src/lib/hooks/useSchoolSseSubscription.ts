// import { useEffect, useRef } from 'react'

// import { getAccessToken } from '@/features/auth/store'
// import { runSchoolSseConnection } from '@/lib/sse/connect-school-sse'
// import type { SchoolSseEnvelopeV1 } from '@/lib/sse/school-sse-types'
// import { env } from '@/lib/utils/env'

// export function useSchoolSseSubscription(options: {
//   schoolId: string
//   enabled: boolean
//   onMessage: (msg: SchoolSseEnvelopeV1) => void
// }) {
//   const { schoolId, enabled, onMessage } = options
//   const onMessageRef = useRef(onMessage)
//   onMessageRef.current = onMessage

//   useEffect(() => {
//     if (!enabled || !schoolId) return

//     const controller = new AbortController()
//     void runSchoolSseConnection({
//       baseUrl: env.SSE_BASE_URL,
//       schoolId,
//       signal: controller.signal,
//       getAccessToken,
//       onMessage: (msg) => onMessageRef.current(msg),
//     })

//     return () => controller.abort()
//   }, [enabled, schoolId])
// }
