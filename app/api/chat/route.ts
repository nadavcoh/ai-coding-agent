import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import {
  readRepositoryStructureSchema,
  readFileContentsSchema,
  proposeGithubPushSchema,
} from "@/lib/tools";
import { getRepositoryStructure, getFileContent } from "@/lib/github";
import { GEMINI_MODELS, DEFAULT_MODEL } from "@/lib/models";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert AI coding agent with deep knowledge of software engineering, architecture patterns, and best practices. You have access to GitHub repositories through specialized tools.

## Your Capabilities
- **Read Repository Structure**: Explore file trees to understand project layout
- **Read File Contents**: Examine source code, configs, and documentation  
- **Propose Code Changes**: Suggest code modifications that require human approval before committing

## Workflow Guidelines
1. **Explore before acting**: Always read the repository structure and relevant files before making suggestions
2. **Explain your reasoning**: Walk through your analysis step-by-step
3. **Propose, don't push**: Use \`propose_github_push\` to suggest changes — a human must approve before anything is committed
4. **Be precise**: When proposing changes, provide complete, production-ready code
5. **Conventional commits**: Use conventional commit format (feat:, fix:, refactor:, docs:, etc.)

## Important Constraints
- Never push code directly — always use propose_github_push and wait for human approval
- When reading large repositories, focus on the most relevant files
- Always include the complete file content in proposals (not just diffs)

Be helpful, thorough, and safety-conscious.`;

const VALID_MODEL_IDS = new Set(GEMINI_MODELS.map((m) => m.id));

export async function POST(request: Request) {
  let resolvedModelId = DEFAULT_MODEL;

  try {
    const body = await request.json();
    const { messages, modelId } = body;

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    resolvedModelId =
      typeof modelId === "string" && VALID_MODEL_IDS.has(modelId)
        ? modelId
        : DEFAULT_MODEL;

    const result = streamText({
      model: google(resolvedModelId),
      system: SYSTEM_PROMPT,
      messages,
      maxSteps: 10,
      tools: {
        read_repository_structure: tool({
          description: "Fetches the complete recursive file tree of a GitHub repository.",
          parameters: readRepositoryStructureSchema,
          execute: async ({ owner, repo, branch }) => {
            try {
              const result = await getRepositoryStructure(owner, repo, branch);
              const tree = result.files
                .map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}`)
                .join("\n");
              return { success: true, owner, repo, branch: result.branch, fileCount: result.files.length, truncated: result.truncated, tree, files: result.files };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : "Failed to fetch repository structure" };
            }
          },
        }),
        read_file_contents: tool({
          description: "Fetches the complete content of a specific file from a GitHub repository.",
          parameters: readFileContentsSchema,
          execute: async ({ owner, repo, file_path, branch }) => {
            try {
              const result = await getFileContent(owner, repo, file_path, branch);
              return { success: true, path: result.path, content: result.content, sha: result.sha, size: result.size };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : "Failed to fetch file contents" };
            }
          },
        }),
        propose_github_push: tool({
          description: "Proposes a code change to be committed to GitHub. Does NOT commit immediately — requires human approval.",
          parameters: proposeGithubPushSchema,
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    const isRateLimit =
      msg.includes("429") ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("resource_exhausted");

    if (isRateLimit) {
      return new Response(
        JSON.stringify({ error: `RATE_LIMITED`, modelId: resolvedModelId }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
