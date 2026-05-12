#!/usr/bin/env node
/**
 * Script to check EntitySheet namespace mismatches
 * Run with: node scripts/check-entitysheet-namespaces.js
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

function findFiles(dir, extension, fileList = []) {
  const files = readdirSync(dir)

  for (const file of files) {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      // Skip node_modules and other ignored directories
      if (
        !file.startsWith('.') &&
        file !== 'node_modules' &&
        file !== 'dist' &&
        file !== 'build'
      ) {
        findFiles(filePath, extension, fileList)
      }
    } else if (file.endsWith(extension)) {
      fileList.push(filePath)
    }
  }

  return fileList
}

function checkEntitySheetUsage(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const issues = []

  // Skip example code in comments
  if (filePath.includes('EntitySheet.tsx') && content.includes('@example')) {
    return issues
  }

  // Find EntitySheet usages
  const entitySheetRegex =
    /<EntitySheet[\s\S]*?namespace=["']([^"']+)["'][\s\S]*?>/g
  let match

  while ((match = entitySheetRegex.exec(content)) !== null) {
    const namespace = match[1]
    const fullMatch = match[0]

    // Extract createTitleKey and editTitleKey
    const createTitleKeyMatch = fullMatch.match(
      /createTitleKey=["']([^"']+)["']/,
    )
    const editTitleKeyMatch = fullMatch.match(/editTitleKey=["']([^"']+)["']/)

    const checkKey = (keyPath, keyName, lineNumber) => {
      if (!keyPath) return

      // Extract namespace from key path (e.g., "teachers.form.createTitle" -> "teachers")
      const keyParts = keyPath.split('.')
      if (keyParts.length > 1) {
        const keyNamespace = keyParts[0]

        // Skip if the first part is a common key like "form", "table", etc.
        // These are valid key paths without namespace prefix
        const commonKeys = ['form', 'table', 'errors', 'actions', 'common']
        if (commonKeys.includes(keyNamespace)) {
          // This is a valid key path without namespace prefix - no issue
          return
        }

        // Special case: "assignment" in "question-studio" namespace is valid
        // The key path "assignment.createTitle" in namespace "question-studio"
        // correctly resolves to "question-studio.assignment.createTitle"
        if (namespace === 'question-studio' && keyNamespace === 'assignment') {
          // This is valid - assignment is a sub-key in question-studio namespace
          return
        }

        // Check if key namespace matches the namespace prop
        if (keyNamespace !== namespace) {
          issues.push({
            file: filePath,
            line: lineNumber,
            type: 'namespace-mismatch',
            message: `Namespace "${namespace}" does not match key path "${keyPath}". Key path includes "${keyNamespace}" which should match the namespace prop.`,
            namespace,
            keyPath,
            keyNamespace,
          })
        } else {
          // Warn that namespace prefix is redundant
          issues.push({
            file: filePath,
            line: lineNumber,
            type: 'redundant-namespace',
            message: `Key path "${keyPath}" includes namespace prefix "${keyNamespace}". Remove the namespace prefix since namespace prop is already set to "${namespace}".`,
            namespace,
            keyPath,
          })
        }
      }
    }

    // Get line number for better error reporting
    const beforeMatch = content.substring(0, match.index)
    const lineNumber = beforeMatch.split('\n').length

    if (createTitleKeyMatch) {
      checkKey(createTitleKeyMatch[1], 'createTitleKey', lineNumber)
    }

    if (editTitleKeyMatch) {
      checkKey(editTitleKeyMatch[1], 'editTitleKey', lineNumber)
    }
  }

  return issues
}

// Main execution
const tsxFiles = findFiles(join(projectRoot, 'src'), '.tsx')
const allIssues = []

for (const file of tsxFiles) {
  const issues = checkEntitySheetUsage(file)
  allIssues.push(...issues)
}

if (allIssues.length > 0) {
  console.error('\n❌ Found EntitySheet namespace issues:\n')
  for (const issue of allIssues) {
    console.error(`  ${issue.file}:${issue.line}\n    ${issue.message}\n`)
  }
  process.exit(1)
} else {
  console.log(
    '✅ All EntitySheet usages have correct namespace/key combinations',
  )
  process.exit(0)
}
