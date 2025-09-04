import { addUser, deleteUser } from "./db/handler";
import { WSHandler } from "./protocol/websocket";
import { RouteHandler } from "./types";
import { verifyUser } from "./utils/middleware";

const routes = new Map<string, RouteHandler>();
routes.set("/vlessws", WSHandler);
routes.set("/user/add", verifyUser(addUser));
routes.set("/user/remove", verifyUser(deleteUser));

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const { pathname } = new URL(request.url);

		const handler = routes.get(pathname);
		if (handler) {
			return handler(request, env);
		}

		return Response.json({
			message: "Not found",
		}, {
			status: 404
		});
	},
} satisfies ExportedHandler<Env>;
