/**
 * Lightweight parser that converts an OpenAPI 3.1 spec into the
 * ApiRouteCategory[] format used by the CLI for display, and into
 * ApiResource[] format for resource/action CLI dispatch.
 */

export interface ApiRoute {
  method: string
  path: string
  description: string
  queryParams?: string
  bodyFields?: string
}

export interface ApiRouteCategory {
  category: string
  description: string
  routes: ApiRoute[]
}

// Resource/action types for CLI dispatch
export interface ApiAction {
  operationId: string     // e.g., "tasks-list"
  action: string          // e.g., "list" (stripped of tag prefix)
  method: string          // HTTP method (uppercase)
  path: string            // URL path template with {param}
  description: string
  pathParams: string[]    // e.g., ["id"]
  queryParams: string[]   // e.g., ["search", "tags"]
  bodyFields: Array<{ name: string; required: boolean }>
}

export interface ApiResource {
  name: string            // tag name
  description: string
  actions: ApiAction[]
}

interface OpenAPIParameter {
  name: string
  in: string
  required?: boolean
}

interface OpenAPIOperation {
  operationId?: string
  summary?: string
  description?: string
  tags?: string[]
  parameters?: OpenAPIParameter[]
  requestBody?: {
    content?: {
      'application/json'?: {
        schema?: {
          description?: string
          properties?: Record<string, { type?: string }>
          required?: string[]
        }
      }
    }
  }
}

interface OpenAPISpec {
  paths?: Record<string, Record<string, OpenAPIOperation>>
  tags?: Array<{ name: string; description?: string }>
}

function extractQueryParams(params?: OpenAPIParameter[]): string | undefined {
  if (!params) return undefined
  const queryParams = params.filter((p) => p.in === 'query').map((p) => p.name)
  return queryParams.length > 0 ? queryParams.join(', ') : undefined
}

function extractBodyFields(op: OpenAPIOperation): string | undefined {
  const schema = op.requestBody?.content?.['application/json']?.schema
  if (!schema) return undefined

  // If the schema has a description like "Fields: x, y?, z", use it directly
  if (schema.description?.startsWith('Fields: ')) {
    return schema.description.slice('Fields: '.length)
  }

  // Otherwise extract from schema properties
  if (schema.properties) {
    const required = new Set(schema.required || [])
    return Object.keys(schema.properties)
      .map((name) => (required.has(name) ? name : `${name}?`))
      .join(', ')
  }

  return undefined
}

export function parseOpenAPISpec(spec: OpenAPISpec): ApiRouteCategory[] {
  const tagDescriptions = new Map<string, string>()
  if (spec.tags) {
    for (const tag of spec.tags) {
      tagDescriptions.set(tag.name, tag.description || '')
    }
  }

  const categories = new Map<string, ApiRoute[]>()

  if (spec.paths) {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!op || typeof op !== 'object') continue
        // Skip OpenAPI meta fields
        if (['parameters', 'summary', 'description', 'servers'].includes(method)) continue

        const tag = op.tags?.[0] || 'other'
        if (!categories.has(tag)) {
          categories.set(tag, [])
        }

        // Convert OpenAPI {param} to Hono :param for CLI display
        const displayPath = path.replace(/\{(\w+)\}/g, ':$1')

        categories.get(tag)!.push({
          method: method.toUpperCase(),
          path: displayPath,
          description: op.summary || op.description || '',
          queryParams: extractQueryParams(op.parameters),
          bodyFields: extractBodyFields(op),
        })
      }
    }
  }

  // Sort categories alphabetically and build result
  const result: ApiRouteCategory[] = []
  for (const [tag, routes] of [...categories.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    result.push({
      category: tag,
      description: tagDescriptions.get(tag) || '',
      routes,
    })
  }

  return result
}

function extractPathParams(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g)
  return matches ? matches.map((m) => m.slice(1, -1)) : []
}

function extractQueryParamNames(params?: OpenAPIParameter[]): string[] {
  if (!params) return []
  return params.filter((p) => p.in === 'query').map((p) => p.name)
}

function extractBodyFieldList(op: OpenAPIOperation): Array<{ name: string; required: boolean }> {
  const schema = op.requestBody?.content?.['application/json']?.schema
  if (!schema) return []

  // Parse from "Fields: title, type?, description?" format
  if (schema.description?.startsWith('Fields: ')) {
    const fieldsStr = schema.description.slice('Fields: '.length)
    return fieldsStr.split(',').map((f) => {
      const trimmed = f.trim()
      const isOptional = trimmed.endsWith('?')
      return {
        name: isOptional ? trimmed.slice(0, -1) : trimmed,
        required: !isOptional,
      }
    })
  }

  // Extract from schema properties
  if (schema.properties) {
    const requiredSet = new Set(schema.required || [])
    return Object.keys(schema.properties).map((name) => ({
      name,
      required: requiredSet.has(name),
    }))
  }

  return []
}

/**
 * Parse the OpenAPI spec into structured resources/actions for CLI dispatch.
 * Only includes operations that have an operationId.
 */
export function parseOpenAPIActions(spec: OpenAPISpec): ApiResource[] {
  const tagDescriptions = new Map<string, string>()
  if (spec.tags) {
    for (const tag of spec.tags) {
      tagDescriptions.set(tag.name, tag.description || '')
    }
  }

  const resourceMap = new Map<string, ApiAction[]>()

  if (spec.paths) {
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!op || typeof op !== 'object') continue
        if (['parameters', 'summary', 'description', 'servers'].includes(method)) continue
        if (!op.operationId) continue

        const tag = op.tags?.[0] || 'other'
        if (!resourceMap.has(tag)) {
          resourceMap.set(tag, [])
        }

        // Strip tag prefix from operationId to get action name
        const prefix = `${tag}-`
        const action = op.operationId.startsWith(prefix)
          ? op.operationId.slice(prefix.length)
          : op.operationId

        resourceMap.get(tag)!.push({
          operationId: op.operationId,
          action,
          method: method.toUpperCase(),
          path,
          description: op.summary || op.description || '',
          pathParams: extractPathParams(path),
          queryParams: extractQueryParamNames(op.parameters),
          bodyFields: extractBodyFieldList(op),
        })
      }
    }
  }

  const result: ApiResource[] = []
  for (const [name, actions] of [...resourceMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    result.push({
      name,
      description: tagDescriptions.get(name) || '',
      actions,
    })
  }

  return result
}
