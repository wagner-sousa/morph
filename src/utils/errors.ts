/**
 * SPEC: typed error hierarchy. Per SDD, errors are part of the contract.
 */
export class MorphError extends Error {
  /** Machine-readable code, mirrors the Web API error codes. */
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class ConfigError extends MorphError {
  constructor(message: string, details?: unknown) {
    super("INVALID_CONFIG", message, details);
  }
}

export class EnvResolutionError extends MorphError {
  constructor(
    message: string,
    public readonly missing: string[],
  ) {
    super("ENV_MISSING", message, { missing });
  }
}

export class MCPNotFoundError extends MorphError {
  constructor(name: string) {
    super("MCP_NOT_FOUND", `MCP server not found: "${name}"`, { name });
  }
}

export class ToolNotFoundError extends MorphError {
  constructor(toolName: string) {
    super("TOOL_NOT_FOUND", `tool not found: "${toolName}"`, { toolName });
  }
}

export class ConflictError extends MorphError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, details);
  }
}
