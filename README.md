# Xray Worker
> Vless over WebSocket implementation on Cloudflare Workers with D1 database for user management

---

## Features

- Vless WebSocket inbound handler
- TCP & UDP support (DNS only)
- 0-RTT early data support
- User management via D1: add, delete

----

## Prerequisites
- Node.js >= 20
- Wrangler CLI
- Cloudflare account
- Git CLI

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/hexrogue/xray-worker
cd xray-worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

> 🔑 **Note**: Make sure your Cloudflare token has **write access** for Workers and D1.

### 3. Verify your login and token permissions

```bash
npx wrangler whoami
```

> This shows which Cloudflare account you’re logged in with. Ensure it matches the account where you want to deploy.

> 🔓 Required Token Permissions
> - account (read)
> - user (read)
> - workers (write)
> - d1 (write)
> - secret_store (write)

### 4. Create a D1 database
```bash
npx wrangler d1 create XRAY
```

### 5. Prepare the database schema

```bash
npx wrangler d1 execute XRAY --file schema.sql --remote
```

> ⚠️ **Important**:
> - By default, executing the schema will generate a **fixed UUID** for the first user.
> - Since this is **a public repository**, you **must delete this default user** and create your own UUID to avoid conflicts or security issues.
> - Use the API or D1 dashboard to remove the default user before adding new users.
> - Always generate a unique UUID for each user you add.

### 6. Deploy
```bash
npx wrangler deploy
```

### 7. Put the `PROXY` secret

```bash
npx wrangler secret put PROXY
```

### 8. Put the `API_TOKEN` secret

```bash
npx wrangler secret put API_TOKEN
```

---

## Usage

### 1. Using Xray-Core/V2Ray client

1. First, go to your Cloudflare Workers dashboard.
2. Find the deployed worker and copy its **URL**.
3. Open your **Xray-Core/V2Ray** client app
4. Copy the example VLESS URL below:
```
vless://0fc57354-40a0-4cef-9064-6e8d491ed8be@workers.dev:443?path=%2Fvlessws&security=tls&encryption=none&host=workers.%20dev&type=ws#Vless%20Worker
```
6. Paste the URL into your client app.
7. Replace `workers.dev` with your deployed worker URL.
-  For example, if your worker URL is `xray-worker.user.worker.dev`, replace both occurrences of `workers.dev` with that.
> **⚠️ Important Notes:**
> - Make sure the path (`/vlessws`) and type (`ws`) match your configuration
> - Make sure the **mux** is disabled.
> - For port 443, **enable TLS security**.
8. Save and connect.

### 2. API Usage

All API endpoints for managing users are documented in [API.md](API.md)

---

## Troubleshooting

### 1. Cannot connect in client app

- Make sure mux is disabled

### 2. Connection fails or cannot surf certain IP/website

- **PROXY secret is required**. Without it, Cloudflare Workers cannot connect certain IP ranges. [See here](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/#considerations)
- Ensure you set it correctly using:
```bash
npx wrangler secret put PROXY
```
- The worker uses this **transparent proxy** to bypass Cloudflare restrictions.

### 3. Deployment or D1 errors

- Ensure your Cloudflare token has **write access** for Workers and D1.
- Check `npx wrangler whoami` to confirm logged-in account.

---

## Contributing

- The codes are messy. I know that.
- Fork the repository and create a new branch for your feature/fix.
- Submit a PR with clear description of changes.
- Only meaningful improvements, bug fixes or documentation updates will be accepted.
> ⚠️ **Note:** Be careful with schema changes or default UUIDs since this is a public repo.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) for details.
