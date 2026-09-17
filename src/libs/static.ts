import path from 'node:path';

export async function createStaticRoutes(dir: string) {
  const glob = new Bun.Glob('**/*');
  const routes: Record<string, Response> = {};

  for await (const file of glob.scan({ cwd: dir, onlyFiles: true })) {
    const routePath = `/${file.replace(/\\/g, '/')}`;
    const fullPath = path.join(dir, file);
    const response = new Response(Bun.file(fullPath));

    // Exact path mapping (e.g., "/css/style.css")
    routes[routePath] = response;

    // Handle index.html shortcuts
    if (routePath === '/index.html') {
      routes['/'] = response;
    } else if (routePath.endsWith('/index.html')) {
      const base = routePath.slice(0, -'/index.html'.length);
      routes[`${base}/`] = response;
      routes[base] = response;
    }
  }

  return routes;
}
