import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../src/db/schema';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const db = drizzle(connection, { schema, mode: 'default' });

  // Create tables
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(255) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','staff') NOT NULL DEFAULT 'staff',
      display_name VARCHAR(100),
      avatar_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      user_id INT NOT NULL,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      status ENUM('open','in_progress','review','closed') NOT NULL DEFAULT 'open',
      priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
      assignee_id INT,
      team_id INT,
      created_by_id INT NOT NULL,
      due_date TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  console.log('✓ Tables created');

  // Seed admin user
  const passwordHash = await bcrypt.hash('admin123', 12);

  await connection.execute(
    `INSERT INTO users (username, email, password_hash, role, display_name)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['joju', 'joju@crewai.app', passwordHash, 'admin', 'Joju']
  );

  console.log('✓ Admin user seeded');
  console.log('  Username: joju');
  console.log('  Password: admin123');

  await connection.end();
}

seed().catch(console.error);
