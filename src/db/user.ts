
export type User = {
	uuid: string;
	email: string;
	created_at: number;
	expired_at: number;
}

export async function getUser(env: Env, uuid: string, expired: number = Date.now()) {
	const query = `SELECT * FROM users WHERE uuid = ? AND expired_at > ? LIMIT 1`;
	const result = env.XRAY.prepare(query).bind(uuid, expired).first<User>();

	return result ?? null;
}

