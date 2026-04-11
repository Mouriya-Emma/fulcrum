/**
 * Escape a string for safe use in shell commands inside single quotes.
 * Handles the edge case where the string itself contains single quotes.
 */
export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

/**
 * Validate a git branch name - only allow safe characters.
 */
export function isValidBranchName(name: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\/_.-]*$/.test(name)
}

/**
 * Validate a directory path - no shell metacharacters.
 */
export function isValidPath(p: string): boolean {
  // Allow ~, /, alphanumeric, -, _, .
  // Must not contain shell metacharacters: ; & | ` $ ( ) { } < > ! ? * [ ] # "
  return /^[~\/a-zA-Z0-9][a-zA-Z0-9\/_.\-~]*$/.test(p)
}

/**
 * Validate a URL format.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
