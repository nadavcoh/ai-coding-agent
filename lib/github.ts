import { Octokit } from "@octokit/rest";

// Server-side only - never expose to client
function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  return new Octokit({ auth: token });
}

export interface RepoFile {
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  size?: number;
  sha: string;
}

export interface RepoTreeResult {
  owner: string;
  repo: string;
  branch: string;
  files: RepoFile[];
  truncated: boolean;
}

export interface FileContentResult {
  path: string;
  content: string;
  sha: string;
  size: number;
  encoding: string;
}

export interface PushResult {
  success: boolean;
  commitSha?: string;
  commitUrl?: string;
  message?: string;
}

/**
 * Fetch the full recursive file tree of a repository
 */
export async function getRepositoryStructure(
  owner: string,
  repo: string,
  branch = "main"
): Promise<RepoTreeResult> {
  const octokit = getOctokit();

  // Get the branch's HEAD commit SHA
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const commitSha = refData.object.sha;

  // Get the tree recursively
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: commitSha,
    recursive: "1",
  });

  const files: RepoFile[] = (treeData.tree || [])
    .filter((item) => item.path && item.type)
    .map((item) => ({
      path: item.path!,
      type: (item.type as RepoFile["type"]) || "file",
      size: item.size,
      sha: item.sha || "",
    }));

  return {
    owner,
    repo,
    branch,
    files,
    truncated: treeData.truncated || false,
  };
}

/**
 * Fetch the content of a specific file
 */
export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  branch = "main"
): Promise<FileContentResult> {
  const octokit = getOctokit();

  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path: filePath,
    ref: branch,
  });

  if (Array.isArray(data)) {
    throw new Error(`Path "${filePath}" is a directory, not a file`);
  }

  if (data.type !== "file") {
    throw new Error(`Path "${filePath}" is not a file (type: ${data.type})`);
  }

  // Decode base64 content
  const content = Buffer.from(data.content, "base64").toString("utf-8");

  return {
    path: filePath,
    content,
    sha: data.sha,
    size: data.size,
    encoding: "utf-8",
  };
}

/**
 * Push a file to GitHub using the Octokit REST API (in-memory, no git CLI)
 * This creates or updates a file by:
 * 1. Getting the current file SHA (if updating)
 * 2. Creating/updating via contents API
 */
export async function pushFileToGitHub(
  owner: string,
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  commitMessage: string
): Promise<PushResult> {
  const octokit = getOctokit();

  try {
    // Get the current file SHA if it exists (required for updates)
    let existingFileSha: string | undefined;
    try {
      const { data: existingFile } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch,
      });
      if (!Array.isArray(existingFile) && existingFile.type === "file") {
        existingFileSha = existingFile.sha;
      }
    } catch (err: unknown) {
      // File doesn't exist yet - that's fine for new files
      if ((err as { status?: number })?.status !== 404) {
        throw err;
      }
    }

    // Encode content to base64
    const encodedContent = Buffer.from(content, "utf-8").toString("base64");

    // Create or update the file
    const { data: commitData } = await octokit.repos.createOrUpdateFileContents(
      {
        owner,
        repo,
        path: filePath,
        message: commitMessage,
        content: encodedContent,
        branch,
        ...(existingFileSha ? { sha: existingFileSha } : {}),
      }
    );

    return {
      success: true,
      commitSha: commitData.commit.sha,
      commitUrl: commitData.commit.html_url,
      message: `Successfully committed to ${owner}/${repo}@${branch}`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error during push",
    };
  }
}

/**
 * List repositories the token can actually read AND push to.
 * Filters to repos where permissions.push is true, so only actionable
 * repos appear in the sidebar.
 */
export async function listAccessibleRepos(): Promise<
  { owner: string; repo: string; full_name: string; private: boolean }[]
> {
  const octokit = getOctokit();

  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 100,
    affiliation: "owner,collaborator,organization_member",
  });

  return data
    .filter((r) => r.permissions?.push === true)
    .map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      full_name: r.full_name,
      private: r.private,
    }));
}
