const GITHUB_API = 'https://api.github.com';

// --- Types ---

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GitHubOrg {
  login: string;
  avatar_url: string;
}

export interface CommitResult {
  date: string;
  sha: string;
  repo: string;
  message: string;
  body: string;
}

export interface SearchResponse {
  commits: CommitResult[];
  totalCount: number;
  truncated: boolean;
}

// --- Helpers ---

function friendlyGitHubError(status: number, body: string): string {
  // Try to extract GitHub's JSON error message
  try {
    const json = JSON.parse(body) as { message?: string };
    if (json.message) {
      if (status === 401) return 'Invalid or expired token. Please create a new one.';
      if (status === 403 && json.message.includes('rate limit'))
        return 'GitHub API rate limit exceeded. Wait a minute and try again.';
      if (status === 403) return `GitHub denied access: ${json.message}`;
      if (status === 422) return `GitHub rejected the request: ${json.message}`;
      return `GitHub API error (${status}): ${json.message}`;
    }
  } catch {
    // Response wasn't JSON (e.g. HTML error page)
  }
  return `GitHub API error (${status})`;
}

async function githubFetch(path: string, token: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      'User-Agent': 'gitpaid',
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(friendlyGitHubError(res.status, body));
  }

  return res;
}

async function githubJson<T>(path: string, token: string): Promise<T> {
  const res = await githubFetch(path, token);
  return res.json() as Promise<T>;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// --- Public API ---

export async function getUser(token: string): Promise<GitHubUser> {
  return githubJson<GitHubUser>('/user', token);
}

export async function getOrgs(token: string): Promise<GitHubOrg[]> {
  const orgs: GitHubOrg[] = [];
  let page = 1;

  while (true) {
    const batch = await githubJson<GitHubOrg[]>(
      `/user/orgs?per_page=100&page=${page}`,
      token,
    );
    orgs.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return orgs;
}

export async function searchCommits(
  token: string,
  username: string,
  scope: string,
  startDate: string,
  endDate: string,
): Promise<SearchResponse> {
  const commits: CommitResult[] = [];
  let page = 1;
  let totalCount = 0;

  // scope is either "org:name" or "user:name"
  const [scopeType, scopeName] = scope.split(':') as [string, string | undefined];
  if (!scopeName || (scopeType !== 'org' && scopeType !== 'user')) {
    throw new Error(`Invalid scope: ${scope}. Use "org:<name>" or "user:<name>".`);
  }

  const query = encodeURIComponent(
    `author:${username} ${scope} author-date:${startDate}..${endDate}`,
  );

  interface SearchApiResponse {
    total_count: number;
    items: Array<{
      sha: string;
      commit: { author: { date: string }; message: string };
      repository: { full_name: string };
    }>;
  }

  while (true) {
    const url = `/search/commits?q=${query}&sort=author-date&order=desc&per_page=100&page=${page}`;
    const data = await githubJson<SearchApiResponse>(url, token);

    if (page === 1) {
      totalCount = data.total_count;
    }

    for (const item of data.items) {
      const lines = item.commit.message.split('\n');
      commits.push({
        date: item.commit.author.date.split('T')[0] ?? '',
        sha: item.sha.substring(0, 7),
        repo: item.repository.full_name,
        message: lines[0] ?? '',
        body: lines.slice(1).join('\n').trim(),
      });
    }

    if (data.items.length < 100 || page >= 10) break;
    page++;
    await sleep(1000); // Rate-limit courtesy
  }

  return {
    commits,
    totalCount,
    truncated: totalCount > 1000,
  };
}
