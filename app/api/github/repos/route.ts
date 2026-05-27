import { listAccessibleRepos } from "@/lib/github";

export async function GET() {
  try {
    if (!process.env.GITHUB_TOKEN) {
      return new Response(JSON.stringify({ repos: [], error: "GitHub token not configured" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const repos = await listAccessibleRepos();
    return new Response(JSON.stringify({ repos }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to list repos:", error);
    return new Response(
      JSON.stringify({
        repos: [],
        error: error instanceof Error ? error.message : "Failed to list repositories",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
