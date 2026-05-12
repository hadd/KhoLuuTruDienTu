/**
 * ESLint rule to detect hardcoded common UI strings that should use i18n
 * Detects strings like "Actions", "Close", "ID:", "Cancel", "Confirm" in JSX
 */

const HARDCODED_STRINGS = [
  'Actions',
  'Close',
  'ID:',
  'ID',
  'Cancel',
  'Confirm',
  'Delete',
  'Edit',
  'Save',
  'Submit',
  'Loading...',
  'Error',
  'Success',
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded common UI strings that should use i18n translation',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      hardcodedString:
        'Hardcoded string "{{value}}" should use i18n translation. Use t() function instead.',
    },
  },
  create(context) {
    function checkStringLiteral(node) {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const value = node.value.trim()

        // Check if it's a hardcoded UI string
        if (HARDCODED_STRINGS.includes(value)) {
          context.report({
            node,
            messageId: 'hardcodedString',
            data: {
              value: node.value,
            },
          })
        }
      }
    }

    function checkJSXText(node) {
      if (node.type === 'JSXText') {
        const value = node.value.trim()

        // Check if it's a hardcoded UI string
        if (HARDCODED_STRINGS.includes(value)) {
          context.report({
            node,
            messageId: 'hardcodedString',
            data: {
              value: node.value.trim(),
            },
          })
        }
      }
    }

    return {
      Literal: checkStringLiteral,
      JSXText: checkJSXText,
    }
  },
}
