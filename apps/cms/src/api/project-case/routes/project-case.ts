import { createPublicContentRoutes } from "../../../lib/public-content";
const routes = createPublicContentRoutes("project-case", "project-cases");
routes.routes.unshift({ method: "GET", path: "/project-cases/slug/:slug", handler: "api::project-case.project-case.findBySlug", config: { auth: false } });
export default routes;
