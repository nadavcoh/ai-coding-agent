import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import {
  readRepositoryStructureSchema,
  readFileContentsSchema,
  proposeGithubPushSchema,
} from "@/lib/tools";
import {
  getRepositoryStructure,
  getFileContent,
} from "@/lib/github";

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

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages,
      maxSteps: 10,
      tools: {
        read_repository_structure: tool({
          description:
            "Fetches the complete recursive file tree of a GitHub repository. Use this first to understand the project structure before reading specific files.",
          parameters: readRepositoryStructureSchema,
          execute: async ({ owner, repo, branch }) => {
            try {
              const result = await getRepositoryStructure(owner, repo, branch);
              // Format as a readable tree
              const tree = result.files
                .map((f) => `${f.type === "dir" ? "📁" : "📄"} ${f.path}`)
                .join("\n");
              return {
                success: true,
                owner,
                repo,
                branch: result.branch,
                fileCount: result.files.length,
                truncated: result.truncated,
                tree,
                files: result.files,
              };
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to fetch repository structure",
              };
            }
          },
        }),

        read_file_contents: tool({
          description:
            "Fetches the complete content of a specific file from a GitHub repository. Use after exploring the structure to read relevant source files.",
          parameters: readFileContentsSchema,
          execute: async ({ owner, repo, file_path, branch }) => {
            try {
              const result = await getFileContent(owner, repo, file_path, branch);
              return {
                success: true,
                path: result.path,
                content: result.content,
                sha: result.sha,
                size: result.size,
              };
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Failed to fetch file contents",
              };
            }
          },
        }),

        propose_github_push: tool({
          description:
            "Proposes a code change to be committed to GitHub. This DOES NOT commit immediately — it sends the proposal to the human for review and approval. Use this when you have a concrete code change to suggest.",
          parameters: proposeGithubPushSchema,
          // No execute function = tool result must be provided by the client (human-in-the-loop)
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);

    // Handle rate limit errors specifically
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const isRateLimit =
      errorMessage.toLowerCase().includes("rate limit") ||
      errorMessage.toLowerCase().includes("quota") ||
      errorMessage.toLowerCase().includes("429");

    return new Response(
      JSON.stringify({
        error: isRateLimit
          ? "Rate limit reached. Please wait a moment before sending another message."
          : errorMessage,
        code: isRateLimit ? "RATE_LIMIT" : "INTERNAL_ERROR",
      }),
      {
        status: isRateLimit ? 429 : 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
