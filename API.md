# Xray Worker API Documentation

> API endpoints for managing users via D1 database.
> All requests **must include** header `token: <API_TOKEN>` where `API_TOKEN` is the secret you set with `npx wrangler secret put API_TOKEN`.

---

## Base URL

```
https://YOUR_WORKER_URL_HERE
```

> Replace `YOUR_WORKER_URL_HERE` with your deployed worker URL.

---

## 1. Add User

POST `/user/add`

### Headers:

```
Token: <API_TOKEN>
```


### Request Body:

```jsonc
{
  "uuid": "string",
  "email": "user@example.com",
  "created_at": 1693824000,
  "expired_at": 1696416000
}
```

### Response:

```json
{
  "message": "success",
  "data": { /* database insert result */ }
}
```

> Notes:
> - `uuid` must be unique
> - `created_at` and `expired_at` are **Unix Timestamp**.
> - This is the only way to programmatically add users.

---

## 2. Delete User

DELETE `/user/delete?uuid=<UUID>`

### Headers:

```
Token: <API_TOKEN>
```

### Example:

```
DELETE /user/delete?uuid=0fc57354-40a0-4cef-9064-6e8d491ed8be
```

### Response:

```json
{
  "message": "success",
  "data": { /* database delete result */ }
}
```

> Notes:
> - Make sure the UUID exists in the database
> - Deleting a user is necessary if you want to replace the **default fixed UUID** created by schema.

