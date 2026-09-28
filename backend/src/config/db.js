import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',       
  port: parseInt(process.env.DB_PORT || '3306'),   
  user: process.env.DB_USER || 'root',             
  password: process.env.DB_PASSWORD || '',          
  database: process.env.DB_NAME || 'timetracker',  
  waitForConnections: true,   
  connectionLimit: 10,        
  dateStrings: true,          
})

export default pool
