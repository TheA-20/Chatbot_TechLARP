import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, {
  max: 10,                // pool máximo de conexiones
  idle_timeout: 20,       // cerrar conexiones inactivas tras 20s
  connect_timeout: 10,
  connection: { client_encoding: 'UTF8' },
})

export default sql
