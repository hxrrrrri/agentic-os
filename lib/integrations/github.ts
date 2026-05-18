/**
 * GitHub REST client. Read-first; writes (comments, issues, dispatches) MUST
 * route through the approval queue.
 */

import { getSecret } from "@/lib/secrets/store";

const API = "https://api.github.com";

async function gh<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await getSecret("GITHUB_TOKEN")) ?? "";
  if (!token) throw new Error("GITHUB_TOKEN not set");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "AgenticOS/0.1",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface GhUser {
  login: string;
  name: string | null;
  public_repos: number;
  followers: number;
  created_at: string;
}

export async function getAuthenticatedUser(): Promise<GhUser> {
  return gh<GhUser>("/user");
}

export interface GhRepo {
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  private: boolean;
}

export async function listUserRepos(per_page = 30): Promise<GhRepo[]> {
  return gh<GhRepo[]>(`/user/repos?per_page=${per_page}&sort=pushed`);
}

export interface GhPull {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  user: { login: string } | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export async function listPulls(repo: string, state: "open" | "closed" | "all" = "open"): Promise<GhPull[]> {
  return gh<GhPull[]>(`/repos/${repo}/pulls?state=${state}&per_page=50`);
}

export interface GhIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
}

export async function listIssues(repo: string, state: "open" | "closed" | "all" = "open"): Promise<GhIssue[]> {
  const all = await gh<GhIssue[]>(`/repos/${repo}/issues?state=${state}&per_page=50`);
  // /issues returns PRs too. Filter via pull_request key (which only PRs have).
  return all.filter((i) => !("pull_request" in i));
}

// Writes — guarded by approval queue at the caller, but never executed without
// the user actively triggering them via /api/integrations/github with mode=write.
export async function postIssueComment(repo: string, number: number, body: string) {
  return gh(`/repos/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function createIssue(repo: string, title: string, body?: string, labels?: string[]) {
  return gh(`/repos/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels }),
  });
}
