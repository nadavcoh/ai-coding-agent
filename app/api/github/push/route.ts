import { pushFileToGitHub } from "@/lib/github";
import { z } from "zod";

const PushRequestSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().min(1),
  file_path: z.string().min(1),
  content: z.string(),
  commit_message: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = PushRequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { owner, repo, branch, file_path, content, commit_message } =
      parsed.data;

    if (!process.env.GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GitHub token is not configured on the server" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = await pushFileToGitHub(
      owner,
      repo,
      branch,
      file_path,
      content,
      commit_message
    );

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        commitSha: result.commitSha,
        commitUrl: result.commitUrl,
        message: result.message,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("GitHub push error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to push to GitHub",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
