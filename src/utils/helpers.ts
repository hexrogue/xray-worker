
export interface Proxy {
	address: string;
	port: number;
}

export function parseProxy(proxy: string): Proxy | undefined {
	if (!proxy) return undefined;

	const [host, port] = proxy.split(":");
	return {
		address: host,
		port: Number(port)
	}
}

export function stringifyUUID(bytes: Uint8Array, offset: number = 0): string {
	if (bytes.length - offset < 16) {
		throw new RangeError("Need at least 16 bytes to stringify UUID");
	}

	const hex = Array.from(bytes.subarray(offset, offset + 16)).map(b => b.toString(16).padStart(2, "0"));
	return (
			hex.slice(0, 4).join("") + "-" +
			hex.slice(4, 6).join("") + "-" +
			hex.slice(6, 8).join("") + "-" +
			hex.slice(8, 10).join("") + "-" +
			hex.slice(10, 16).join("")
	).toLowerCase();
}
