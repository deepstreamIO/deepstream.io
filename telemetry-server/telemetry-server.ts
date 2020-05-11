const port = process.env.TELEMETRY_PORT || 8080

import * as express from 'express'
import * as bodyParser from 'body-parser'
import { Pool } from 'pg'

const app = express()
const pool = new Pool()

async function insertStats (stats: any) {
  const { record, event, presence, rpc } = stats.enabledFeatures
  const valueStrings  = `('${stats.deploymentId}','${stats.deepstreamVersion}','${stats.nodeVersion}','${stats.platform}','${record}','${event}','${presence}','${rpc}','${JSON.stringify(stats).replace(/'/g, "''")}')`

  await pool.query(`
      INSERT INTO "public"."telemetry" (id, version, nodeVersion, platform, record, event, presence, rpc, json)
      VALUES ${valueStrings}
      ON CONFLICT (id)
      DO UPDATE SET version = EXCLUDED.version, nodeVersion = EXCLUDED.nodeVersion, platform = EXCLUDED.platform, record = EXCLUDED.record, event = EXCLUDED.event, presence = EXCLUDED.presence, rpc = EXCLUDED.rpc, json = EXCLUDED.json, revision = telemetry.revision + 1;
  `)

  console.log(`Updated ${stats.deploymentId}`)
}

// parse application/json
app.use(bodyParser.json())

app.post('/api/v1/startup', async (req, res) => {
  await insertStats(req.body)
  res.json({ success: true })
})

app.listen(port, () => console.log(`Telemetry listening on port ${port}`))