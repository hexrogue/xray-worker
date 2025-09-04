
export type RouteHandler = (
	request: Request,
	env: Env,
) => Promise<Response>;
