import { z } from "zod";

export const readRepositoryStructureSchema = z.object({
  owner: z.string().describe("GitHub repository owner/organization name"),
  repo: z.string().describe("GitHub repository name"),
  branch: z
    .string()
    .default("main")
    .describe("Branch to read from (defaults to main)"),
});

export const readFileContentsSchema = z.object({
  owner: z.string().describe("GitHub repository owner/organization name"),
  repo: z.string().describe("GitHub repository name"),
  file_path: z
    .string()
    .describe("Path to the file within the repository (e.g. src/index.ts)"),
  branch: z
    .string()
    .default("main")
    .describe("Branch to read from (defaults to main)"),
});

export const proposeGithubPushSchema = z.object({
  owner: z.string().describe("GitHub repository owner/organization name"),
  repo: z.string().describe("GitHub repository name"),
  branch: z.string().describe("Target branch for the commit"),
  file_path: z
    .string()
    .describe("Destination file path within the repository"),
  content: z
    .string()
    .describe("The complete new file content to be committed"),
  commit_message: z
    .string()
    .describe(
      "Git commit message explaining what changed and why (conventional commits format preferred)"
    ),
  original_content: z
    .string()
    .optional()
    .describe("Original file content for diff display (if replacing an existing file)"),
});

export type ReadRepositoryStructureInput = z.infer<
  typeof readRepositoryStructureSchema
>;
export type ReadFileContentsInput = z.infer<typeof readFileContentsSchema>;
export type ProposeGithubPushInput = z.infer<typeof proposeGithubPushSchema>;
