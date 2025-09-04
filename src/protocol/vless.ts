import { getUser, User } from "../db/user";
import { stringifyUUID } from "../utils/helpers";

interface VlessHeaderResult {
	hasError: boolean;
	message?: string;
	address?: string;
	addressType?: number;
	port?: number;
	rawDataIndex?: number;
	vlessVersion?: Uint8Array;
	network?: "udp" | "tcp";
	user?: User | null;
	userID?: string;
}

const VLESS_VERSION_OFFSET = 0
const VLESS_USER_ID_OFFSET = 1
const VLESS_USER_ID_LENGTH = 16
const VLESS_OPT_LEN_OFFSET = VLESS_USER_ID_OFFSET + VLESS_USER_ID_LENGTH

export async function vlessHeaderParser(buffer: ArrayBuffer, env: Env): Promise<VlessHeaderResult> {
	if (buffer.byteLength < 24) {
		return {
			hasError: true,
			message: "Invalid data"
		}
	}

	// https://xtls.github.io/en/development/protocols/vless.html
	// Vless version
	const version = new Uint8Array(buffer.slice(VLESS_VERSION_OFFSET, VLESS_VERSION_OFFSET + 1))
	const userID = stringifyUUID(
		new Uint8Array(
			buffer.slice(VLESS_USER_ID_OFFSET, VLESS_USER_ID_OFFSET + VLESS_USER_ID_LENGTH)
		)
	);

	const user = await getUser(env, userID);

	// Options length
	const optLength = new Uint8Array(buffer.slice(VLESS_OPT_LEN_OFFSET, VLESS_OPT_LEN_OFFSET + 1))[0];

	// Protocol
	const PROTOCOL_OFFSET = VLESS_OPT_LEN_OFFSET + 1 + optLength; // simplify: 18 + option length
	const protocol = new Uint8Array(buffer.slice(PROTOCOL_OFFSET, PROTOCOL_OFFSET + 1))[0];


	let network: "tcp" | "udp" | undefined;
	if (protocol === 1) {
		network = "tcp";
	} else if (protocol === 2) {
		network = "udp";
	} else {
		return {
			hasError: true,
			message: `Protocol ${protocol} is not supported (yet)`
		}
	}

	// Port
	const PORT_OFFSET = PROTOCOL_OFFSET + 1;
	const port = new DataView(buffer.slice(PORT_OFFSET, PORT_OFFSET + 2)).getUint16(0);

	// Address
	let addrOffset = PORT_OFFSET + 2;
	const addrType = new Uint8Array(buffer.slice(addrOffset, addrOffset + 1))[0]
	addrOffset += 1;

	let address = "";
	switch (addrType) {
		case 1: // IPv4
			address = new Uint8Array(buffer.slice(addrOffset, addrOffset + 4)).join(".");
		addrOffset += 4;
		break;
		case 2: // Domain
			const length = new Uint8Array(buffer.slice(addrOffset, addrOffset + 1))[0];
		addrOffset += 1;
		address = new TextDecoder().decode(buffer.slice(addrOffset, addrOffset + length));
		addrOffset += length;
		break
		case 3: // IPv6
			const dv = new DataView(buffer.slice(addrOffset, addrOffset + 16));
		const ipv6: string[] = [];
		for (let i = 0;i < 16;i += 2) ipv6.push(dv.getUint16(i).toString(16));
		address = ipv6.join(":");
		addrOffset += 16;
		break;
		default:
			return {
			hasError: true,
			message: `Invalid address type: ${addrType}`
		}
	}

	if (!address) return {
		hasError: true,
		message: "Empty address"
	}

	return {
		hasError: false,
		address,
		addressType: addrType,
		port,
		rawDataIndex: addrOffset,
		vlessVersion: version,
		network,
		user,
		userID,
	}
}

