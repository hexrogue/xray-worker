import { User } from "./user";

export async function addUser(request: Request, env: Env): Promise<Response> {
	try {
		const { uuid, email, created_at, expired_at } = await request.json<User>();

		const stmt = env.XRAY.prepare(
			`INSERT INTO users (uuid, email, expired_at, created_at) VALUES (?, ?, ?, ?);`
		).bind(uuid, email, expired_at, created_at);

		const result = await stmt.run();
		return Response.json({
			message: "success",
			data: result,
		});
	} catch (err) {
		return Response.json({
			message: err,
		}, {
			status: 503
		})
	}
}

export async function deleteUser(request: Request, env: Env): Promise<Response> {
	try {
		const { searchParams } = new URL(request.url);
		const uuid = searchParams.get("uuid");

		if (!uuid) throw new Error("User not found");

		const stmt = env.XRAY.prepare(
			`DELETE FROM users WHERE uuid = ?`
		).bind(uuid);
		const result = await stmt.run();
		return Response.json({
			message: "success",
			data: result,
		})
	} catch (err) {
		return Response.json({
			message: err
		}, {
			status: 503
		});
	}
}
