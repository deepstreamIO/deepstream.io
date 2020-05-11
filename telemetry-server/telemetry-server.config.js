module.exports = {
    apps : [
        {
          name: "telemetry-server",
          script: "npm run start",
          env: {
            PGUSER:"postgres",
            PGDATABASE:"deepstream",
            PGHOST:"localhost",
            PGPASSWORD:"secretpassword"
          }
        }
    ]
  }