const bcrypt = require('bcryptjs')
const postgres = require('postgres')

bcrypt.hash('123456789', 12).then(async hash => {
  const sql = postgres({
    host: 'localhost', port: 5432,
    database: 'edularp', user: 'postgres', password: 'password_segura'
  })
  await sql`UPDATE usuarios SET password_hash = ${hash} WHERE email = 'admin@edularp.es'`
  await sql.end()
  console.log('Password updated OK')
}).catch(err => { console.error(err); process.exit(1) })
