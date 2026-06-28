type BasePathEnv = {
  GITHUB_PAGES?: string;
};

export function getBasePath(env: BasePathEnv) {
  return env.GITHUB_PAGES === 'true' ? '/yamato-vikings-hub/' : '/';
}
