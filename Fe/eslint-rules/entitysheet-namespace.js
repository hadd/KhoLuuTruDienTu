/**
 * ESLint rule to detect namespace mismatches in EntitySheet usage
 * Warns when namespace prop doesn't match the key path in createTitleKey/editTitleKey
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect namespace mismatches in EntitySheet component usage',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      namespaceMismatch:
        'Namespace "{{namespace}}" does not match key path "{{keyPath}}". Key path includes "{{keyNamespace}}" which should match the namespace prop.',
      keyPathWithNamespace:
        'Key path "{{keyPath}}" includes namespace prefix. Remove the namespace prefix since namespace prop is already set to "{{namespace}}".',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        // Check if this is an EntitySheet component
        if (
          node.name.type === 'JSXIdentifier' &&
          node.name.name === 'EntitySheet'
        ) {
          let namespace = null
          let createTitleKey = null
          let editTitleKey = null

          // Extract props
          node.attributes.forEach((attr) => {
            if (attr.type === 'JSXAttribute' && attr.name) {
              const propName = attr.name.name
              const propValue = attr.value

              if (propName === 'namespace' && propValue?.type === 'Literal') {
                namespace = propValue.value
              } else if (
                propName === 'createTitleKey' &&
                propValue?.type === 'Literal'
              ) {
                createTitleKey = propValue.value
              } else if (
                propName === 'editTitleKey' &&
                propValue?.type === 'Literal'
              ) {
                editTitleKey = propValue.value
              }
            }
          })

          // Check for namespace mismatches
          if (namespace) {
            const checkKey = (keyPath, keyName) => {
              if (!keyPath) return

              // Extract namespace from key path (e.g., "teachers.form.createTitle" -> "teachers")
              const keyParts = keyPath.split('.')
              if (keyParts.length > 1) {
                const keyNamespace = keyParts[0]

                // Check if key namespace matches the namespace prop
                if (keyNamespace !== namespace) {
                  context.report({
                    node: attr,
                    messageId: 'namespaceMismatch',
                    data: {
                      namespace,
                      keyPath,
                      keyNamespace,
                    },
                  })
                } else {
                  // Warn that namespace prefix is redundant
                  context.report({
                    node: attr,
                    messageId: 'keyPathWithNamespace',
                    data: {
                      namespace,
                      keyPath,
                    },
                  })
                }
              }
            }

            // Check both keys
            if (createTitleKey) {
              node.attributes.forEach((attr) => {
                if (
                  attr.type === 'JSXAttribute' &&
                  attr.name?.name === 'createTitleKey'
                ) {
                  checkKey(createTitleKey, 'createTitleKey')
                }
              })
            }

            if (editTitleKey) {
              node.attributes.forEach((attr) => {
                if (
                  attr.type === 'JSXAttribute' &&
                  attr.name?.name === 'editTitleKey'
                ) {
                  checkKey(editTitleKey, 'editTitleKey')
                }
              })
            }
          }
        }
      },
    }
  },
}
