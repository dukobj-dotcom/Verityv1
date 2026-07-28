module.exports = {
  apps: [{
    name: "verity-bridge",
    script: "server.js",
    cwd: "/opt/verity/ai-bridge",
    env: {
      PORT: "8080",
      DEBUG_PORT: "19144",
      HISTORY_DIR: "/opt/verity-bridge/data",
      HISTORY_LIMIT: "32",
      GROQ_MODEL: "llama-3.3-70b-versatile",
      NODE_ENV: "production"
    }
  }]
}
