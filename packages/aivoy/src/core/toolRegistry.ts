import type { Tool, ToolRunContext } from './types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(initial: Tool[] = []) {
    for (const t of initial) this.register(t);
  }

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  async run(
    name: string,
    args: unknown,
    ctx: ToolRunContext,
  ): Promise<{ ok: true; result: unknown; renderAs?: string } | { ok: false; error: string }> {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` };

    let runArgs: unknown = args ?? {};
    if (tool.input) {
      // zod-schema tool — validate at runtime.
      const parsed = tool.input.safeParse(args ?? {});
      if (!parsed.success) {
        return { ok: false, error: `Invalid args for ${name}: ${parsed.error.message}` };
      }
      runArgs = parsed.data;
    }
    // Vanilla tools (parameters: JSON Schema) skip runtime validation —
    // the LLM is constrained by the schema we sent it; trust-but-verify.

    try {
      const result = await tool.run(runArgs as never, ctx);
      return { ok: true, result, renderAs: tool.renderAs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg };
    }
  }
}
