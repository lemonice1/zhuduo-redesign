module.exports = ({ env }) => ({
  enabled: env.bool("AUTO_TRANSLATE_ENABLED", false),
  apiUrl: env("AUTO_TRANSLATE_API_URL", ""),
  apiKey: env("AUTO_TRANSLATE_API_KEY", ""),
  model: env("AUTO_TRANSLATE_MODEL", ""),
  timeoutMs: env.int("AUTO_TRANSLATE_TIMEOUT_MS", 30000)
});
