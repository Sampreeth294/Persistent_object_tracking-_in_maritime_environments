import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Shell from "./components/Shell";
import "./index.css";
import JobWorkspace from "./pages/JobWorkspace";
import Jobs from "./pages/Jobs";
import Overview from "./pages/Overview";
import Videos from "./pages/Videos";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 2000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Overview /> },
      { path: "videos", element: <Videos /> },
      { path: "jobs", element: <Jobs /> },
      { path: "jobs/:id", element: <JobWorkspace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
