import { connect } from "cloudflare:sockets";
import { vlessHeaderParser } from "./vless";
import { parseProxy, Proxy } from "../utils/helpers";
import { env } from "cloudflare:workers";

interface RemoteSocketWrapper {
	tcp?: Socket;
	udp?: TransformStream;
}

const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;

function closeWebsocket(websocket: WebSocket) {
	try {
		if (websocket.readyState === WS_READY_STATE_OPEN) {
			// websocket.dispatchEvent(new Event("error"));
			// websocket.dispatchEvent(new CloseEvent("close"));
			websocket.close();
		}
	} catch (err) {
		console.warn("Error while dispatching close/error events:", err);
	}
}

export async function WSHandler(request: Request, env: Env) {
	const { searchParams } = new URL(request.url);

	const proxyRaw = searchParams.get("proxy") || env.PROXY;
	const proxy = parseProxy(proxyRaw);

	const remoteAddress = request.headers.get("CF-Connecting-IP");

	const [client, websocket] = Object.values(new WebSocketPair());
	websocket.accept();

	let isStreamCancelled = false;
	const wsReadable = new ReadableStream({
		start(controller) {
			websocket.addEventListener("message", (event) => {
				controller.enqueue(event.data);
			});

			websocket.addEventListener("close", () => {
				if (!isStreamCancelled) controller.close();
			});

			websocket.addEventListener("error", (err) => {
				if (!isStreamCancelled) controller.error(err);
			});

			// For websocket 0-RTT
			let earlyDataHeader = request.headers.get("sec-websocket-protocol");
			if (earlyDataHeader) {
				try {
					earlyDataHeader = earlyDataHeader.replace(/-/g, "+").replace(/_/, "/");
					const decoded = atob(earlyDataHeader);
					const decodedBytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
					controller.enqueue(decodedBytes);
				} catch (err) {
					controller.error(err);
				}
			}
		},

		cancel(reason) {
			isStreamCancelled = true;
			console.warn("Websocket closed:", reason);
		}
	});

	const remoteSocket: RemoteSocketWrapper = {};
	let udpMode: "dns" | "generic" | null = null;

	// Websocket -> remote
	wsReadable.pipeTo(new WritableStream({
		async write(chunk, controller) {
			if (udpMode === "dns" && remoteSocket.udp) {
				const writer = remoteSocket.udp.writable.getWriter();
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			if (remoteSocket.tcp) {
				const writer = remoteSocket.tcp.writable.getWriter();
				await writer.write(chunk);
				writer.releaseLock();
				return;
			}

			const parsed = await vlessHeaderParser(chunk, env);
			if (parsed.hasError || !parsed.address || !parsed.port) {
				controller.error(parsed.message);
				closeWebsocket(websocket);
				throw new Error(parsed.message);
			}

			const {
				port,
				network,
				vlessVersion,
				address,
				rawDataIndex,
				user,
				userID,
			} = parsed;

			if (!user) {
				controller.error("Unauthorized");
				console.warn(`[UUID: ${userID} | IP Address: ${remoteAddress}] Unauthorized`)
				return closeWebsocket(websocket);
			}

			if (network === "udp") {
				if (port === 53) {
					udpMode = "dns";
				} else {
					console.warn(`Got UDP request but not supported yet`);
					udpMode = "generic";
					return;
				}
			}

			// https://xtls.github.io/en/development/protocols/vless.html # Response
			const version = vlessVersion ? vlessVersion[0] : 0;
			const vlessResponseHeader = new Uint8Array([version, 0]);
			const rawClientData = chunk.slice(rawDataIndex);

			if (udpMode === "dns") {
				console.info("Got UDP request from", remoteAddress);
				handleUDPOutBound(remoteSocket, websocket, rawClientData, vlessResponseHeader, remoteAddress);
			} else {
				// Handle TCP Outbound
				handleTCPOutBound(remoteSocket, websocket, address, port, rawClientData, vlessResponseHeader, proxy, remoteAddress);
			}
		},
		close() {
			// console.info("Readable stream closed:");
		},
		abort(reason) {
			console.warn("Readable stream aborted:", reason);
		}
	}))
	.catch((error) => {
		console.error(error);
		closeWebsocket(websocket);
	})

	return new Response(null, {
		status: 101,
		webSocket: client,
	});
}

async function handleTCPOutBound(remoteSocket: RemoteSocketWrapper, websocket: WebSocket, address: string, port: number, rawClientData: ArrayBuffer, vlessResponseHeader: Uint8Array<ArrayBuffer>, proxy?: Proxy, remoteAddress?: string | null) {
	let retries = 0;
	const maxRetries = 5;

	console.info(`Received TCP request from ${remoteAddress}`)

	async function connectAndWrite(host: string, port: number, data: ArrayBuffer): Promise<Socket | null> {
		try {
			const socket = connect({ hostname: host, port });

			remoteSocket.tcp = socket;
			const writer = socket.writable.getWriter();
			await writer.write(data);
			writer.releaseLock();

			return socket;
		} catch (error) {
			console.error("connectAndWrite error:", error);
			console.info("Retries count:", retries);
			return null;
		}
	}

	async function retry(): Promise<void> {
		try {
			const targetHost = proxy?.address || address;
			const targetPort = proxy?.port || port;

			const socket = await connectAndWrite(targetHost, targetPort, rawClientData);
			if (socket) {
				await remoteSocketToWebsocket(socket, websocket, vlessResponseHeader, retry);
			}
		} catch (error) {
			console.error("handleTCPOutound error: ", error);
			if (retries < maxRetries) {
				retries++;
				console.warn("Retrying TCP connection with(out) proxy");
				await retry();
			} else {
				console.error("Max retries reached, closing websocket");
				closeWebsocket(websocket);
			}
		}
	}

	// First attempt
	const socket = await connectAndWrite(address, port, rawClientData);
	if (socket) {
		return await remoteSocketToWebsocket(socket, websocket, vlessResponseHeader, retry);
	}
	closeWebsocket(websocket);
}

async function remoteSocketToWebsocket(TCPSocket: Socket, websocket: WebSocket, vlessResponseHeader?: Uint8Array<ArrayBuffer>, retry?: Function) {
	let hasIncomingData = false;

	try {
		await TCPSocket.readable.pipeTo(new WritableStream({
			async write(chunk, controller) {
				hasIncomingData = true;
				if (websocket.readyState !== WS_READY_STATE_OPEN) {
					return controller.error("Websocket closed");
				}

				if (vlessResponseHeader) {
					const data = new Uint8Array(vlessResponseHeader.byteLength + chunk.byteLength);
					data.set(new Uint8Array(vlessResponseHeader), 0);
					data.set(new Uint8Array(chunk), vlessResponseHeader.byteLength);
					websocket.send(data);
					vlessResponseHeader = undefined;
				} else {
					websocket.send(chunk);
				}
			},
			close() {
				// console.info("TCP closed");
			},
			abort(reason) {
				console.error("TCP aborted:", reason);
			}
		}));
	} catch (error) {
		console.error("Pipe exception:", error);
		closeWebsocket(websocket);
	}

	if (!hasIncomingData && retry) {
		await retry();
	}
}

async function handleUDPOutBound(remoteSocket: RemoteSocketWrapper, websocket: WebSocket, rawClientData: ArrayBuffer, vlessResponseHeader?: Uint8Array<ArrayBuffer>, remoteAddress?: string | null) {
	console.info(`Recieved UDP request from ${remoteAddress}`)
	const transform = new TransformStream({
		transform(chunk, controller) {
			for (let index = 0;index < chunk.byteLength;) {
				const len = new DataView(chunk.slice(index, index + 2)).getUint16(0);
				const udpData = new Uint8Array(chunk.slice(index + 2, index + 2 + len));
				controller.enqueue(udpData);
				index += 2 + len;
			}
		}
	});

	transform.readable.pipeTo(new WritableStream({
		async write(chunk, controller) {
			try {
				const response = await fetch(env.DNS_RESOLVER || "https://1.1.1.1/dns-query", {
					method: "POST",
					headers: { "Content-Type": "application/dns-message" },
					body: chunk,
				});

				if (!response.ok) {
					throw new Error(`DoH failed ${response.status}`);
				}
				const DNSQueryResult = new Uint8Array(await response.arrayBuffer());
				const sizeBuf = new Uint8Array([(DNSQueryResult.length >> 8) & 0xff, DNSQueryResult.length & 0xff]);

				if (websocket.readyState !== WS_READY_STATE_OPEN) {
					controller.error("Websocket not open");
				}

				let payload: Uint8Array<ArrayBuffer>;
				if (!vlessResponseHeader) {
					payload = new Uint8Array(sizeBuf.length + DNSQueryResult.length);
					payload.set(sizeBuf, 0);
					payload.set(DNSQueryResult, sizeBuf.length);
				} else {
					payload = new Uint8Array(vlessResponseHeader.length + sizeBuf.length + DNSQueryResult.length);
					let offset = 0;
					payload.set(vlessResponseHeader, offset);
					offset += vlessResponseHeader.length;
					payload.set(sizeBuf, offset);
					offset += sizeBuf.length;
					payload.set(DNSQueryResult, offset);
					vlessResponseHeader = undefined;
				}
				websocket.send(payload);
			} catch (error) {
				console.error(error);
				controller.error(error);
			}
		}
	}))
	.catch(err => {
		console.error(err);
		closeWebsocket(websocket);
	});

	const writer = transform.writable.getWriter();
	await writer.write(rawClientData);
	writer.releaseLock();

	remoteSocket.udp = transform;
	return transform;
}
