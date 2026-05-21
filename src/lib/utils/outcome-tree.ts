// import type { OutcomeT } from '@/types/common'

// type OutcomeLike = Pick<OutcomeT, 'id' | 'order' | 'createdAt'> & {
//   children?: Array<OutcomeLike>
// }

// export function compareOutcomeTreeNode<T extends OutcomeLike>(a: T, b: T) {
//   const byOrder = a.order - b.order
//   if (byOrder !== 0) return byOrder

//   // Fallback: createdAt (asc). Treat null as "smallest" (null first).
//   if (a.createdAt === null || b.createdAt === null) {
//     if (a.createdAt === b.createdAt) {
//       return a.id.localeCompare(b.id)
//     }
//     return a.createdAt === null ? -1 : 1
//   }

//   const aTime = Date.parse(a.createdAt)
//   const bTime = Date.parse(b.createdAt)
//   const aValid = Number.isFinite(aTime)
//   const bValid = Number.isFinite(bTime)

//   if (aValid && bValid) {
//     const byCreatedAt = aTime - bTime
//     if (byCreatedAt !== 0) return byCreatedAt
//   } else if (aValid !== bValid) {
//     // Invalid dates sort after valid dates (but still after null-first handling above).
//     return aValid ? -1 : 1
//   }

//   // Final deterministic tiebreaker.
//   return a.id.localeCompare(b.id)
// }

// type SortOutcomeTreeOptions<T> = {
//   getChildren?: (node: T) => Array<T> | undefined
//   setChildren?: (node: T, children: Array<T> | undefined) => T
// }

// export function sortOutcomeTree<T extends OutcomeLike>(
//   nodes: Array<T>,
//   options?: SortOutcomeTreeOptions<T>,
// ): Array<T> {
//   const getChildren = options?.getChildren ?? ((node: T) => node.children)
//   const setChildren =
//     options?.setChildren ??
//     ((node: T, children: Array<T> | undefined) => ({
//       ...(node),
//       children,
//     }))

//   const mapped = nodes.map((node) => {
//     const children = getChildren(node)
//     if (!children || children.length === 0) {
//       return setChildren(node, undefined)
//     }
//     return setChildren(node, sortOutcomeTree(children, options))
//   })

//   return mapped.sort(compareOutcomeTreeNode)
// }
