module.exports = ({ env }) => ({
  connection: {
    client: "postgres",
    connection: {
      connectionString: env("DATABASE_URL"),
      host: env("DATABASE_HOST", "127.0.0.1"),
      port: env.int("DATABASE_PORT", 5432),
      database: env("DATABASE_NAME", "modular_housing_dev"),
      user: env("DATABASE_USERNAME", "modular_dev"),
      password: env("DATABASE_PASSWORD", "change-this-dev-password"),
      schema: env("DATABASE_SCHEMA", "public"),
      ssl: env.bool("DATABASE_SSL", false)
        ? { rejectUnauthorized: env.bool("DATABASE_SSL_REJECT_UNAUTHORIZED", true) }
        : false
    },
    pool: { min: 0, max: env.int("DATABASE_POOL_MAX", 10) }
  }
});
