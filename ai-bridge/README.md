# VERITY ONLINE public AI bridge

This service accepts Minecraft Bedrock's Script Debugger protocol on TCP `19144`
and provides a pairing page on HTTP `8080`. It is based on the documented
debugger framing protocol and the MIT-licensed Hive Mind Debugger technique by
TrayePlays; it intentionally implements only Verity's chat route, never a
general public HTTP proxy.

Keys are kept in RAM for 12 hours, are never sent to the behavior pack, and
are erased on restart. Production hosting needs both public ports: TCP 19144
and HTTP 8080. See `docs/PUENTE_GROQ.md` in the addon repository.
