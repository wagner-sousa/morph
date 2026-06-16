import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Mcps } from './pages/Mcps';
import { MCPDetail } from './pages/MCPDetail';
import { Logs } from './pages/Logs';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2000 },
  },
});

function Layout() {
  return (
    <div className="min-h-screen bg-morph-bg text-morph-text">
      <Sidebar />
      <main className="ml-56 p-6">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  ),
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Dashboard,
});

const mcpsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mcps',
  component: Mcps,
});

const mcpDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mcps/$name',
  component: MCPDetail,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/logs',
  component: Logs,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stats',
  component: Stats,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  mcpsRoute,
  mcpDetailRoute,
  logsRoute,
  statsRoute,
  settingsRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export function App() {
  return <RouterProvider router={router} />;
}
