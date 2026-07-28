# VERITY ONLINE public AI bridge

This service accepts Minecraft Bedrock's Script Debugger protocol on TCP `19144`
and provides a pairing page on HTTP `8080`. It is based on the documented
debugger framing protocol and the MIT-licensed Hive Mind Debugger technique by
TrayePlays; it intentionally implements only Verity's chat route, never a
general public HTTP proxy.

Keys are kept in RAM for 12 hours, are never sent to the behavior pack, and
are erased on restart. Production hosting needs both public ports: TCP 19144
and HTTP 8080. See `docs/PUENTE_GROQ.md` in the addon repository.

## Kamatera / VPS configuration

Use HTTPS for the pairing page: never ask players to paste a Groq key into an
`http://` URL. Put a reverse proxy with TLS in front of port `8080` and expose
TCP `19144` separately for the Minecraft Script Debugger.

Set these environment variables in PM2 or the service unit:

```text
PORT=8080
DEBUG_PORT=19144
HISTORY_DIR=/opt/verity-bridge/data
HISTORY_LIMIT=32
GROQ_MODEL=llama-3.3-70b-versatile
```

Create `HISTORY_DIR` and make it writable by the user running Node. This
directory stores up to 32 chat turns per player and Groq key, so conversation
memory survives a player leaving the world and a PM2 restart. Back it up as
private player data.
