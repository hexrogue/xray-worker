import { RouteHandler } from "../types";

export function verifyUser(handler: RouteHandler): RouteHandler {
	return async (request: Request, env: Env) => {
		const token = request.headers.get("token") || "";
		if (token !== env.API_TOKEN) {
			return Response.json({
				message: "Unauthorized",
			}, {
				status: 401
			})
		}
		return handler(request, env);
	}
}
