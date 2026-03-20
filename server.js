const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.office365.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000      // 60 seconds
};

// Function to send email notification
async function sendEmailNotification(email, name, drink) {
  if (!email || !EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.log('Email not configured or no email provided');
    return;
  }

  console.log(`Attempting to send email to ${email} for ${name}'s ${drink}`);
  console.log('SMTP Config:', {
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    user: EMAIL_CONFIG.auth.user ? '***configured***' : 'missing',
    pass: EMAIL_CONFIG.auth.pass ? '***configured***' : 'missing'
  });

  try {
    const nodemailer = require('nodemailer');
    
    // Test connection first
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);
    
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    const mailOptions = {
      from: {
        name: 'Drinks Helper',
        address: EMAIL_CONFIG.auth.user
      },
      to: email,
      subject: '🍹 Your drink is ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your drink is ready!</title>
        </head>
        <body style="margin: 0; padding: 32px 16px; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0d0d0f; min-height: 100vh;">
          <!-- Outer wrapper -->
          <div style="max-width: 480px; margin: 0 auto;">

            <!-- Card -->
            <div style="background-color: #15151a; border: 1px solid #2a2a35; border-radius: 20px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.6);">

              <!-- Gold top bar -->
              <div style="height: 3px; background: linear-gradient(90deg, #c9903a, #f0c97a, #c9903a);"></div>

              <!-- Body -->
              <div style="padding: 40px 36px;">

                <!-- Icon -->
                <div style="width: 64px; height: 64px; margin: 0 auto 24px; background-color: rgba(201,144,58,0.15); border: 1px solid rgba(201,144,58,0.3); border-radius: 16px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 64px;">
                  <span style="font-size: 28px; line-height: 64px; display: block;">🍹</span>
                </div>

                <!-- Eyebrow -->
                <p style="margin: 0 0 8px; text-align: center; font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #c9903a;">Drinks Bot</p>

                <!-- Heading -->
                <h1 style="margin: 0 0 8px; text-align: center; font-size: 26px; font-weight: 700; color: #e8e4dc; line-height: 1.2;">Your drink is ready!</h1>

                <!-- Subheading -->
                <p style="margin: 0 0 28px; text-align: center; font-size: 14px; color: #7a7870; font-weight: 300;">Head to the bar to collect your order</p>

                <!-- Divider -->
                <div style="height: 1px; background: linear-gradient(90deg, transparent, #2a2a35, transparent); margin-bottom: 28px;"></div>

                <!-- Order details box -->
                <div style="background-color: #1c1c23; border: 1px solid #2a2a35; border-radius: 12px; padding: 20px 24px; margin-bottom: 28px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #4a4845; width: 40%;">Name</td>
                      <td style="padding: 6px 0; font-size: 15px; font-weight: 500; color: #e8e4dc;">${name}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #4a4845;">Drink</td>
                      <td style="padding: 6px 0; font-size: 15px; font-weight: 600; color: #e8b96a;">${drink}</td>
                    </tr>
                  </table>
                </div>

                <!-- Body text -->
                <p style="margin: 0 0 32px; text-align: center; font-size: 14px; line-height: 1.7; color: #7a7870;">
                  Please come and collect your drink when you're ready.<br>
                  We'll keep it waiting for you at the bar.
                </p>

                <!-- Footer -->
                <p style="margin: 0; text-align: center; font-size: 13px; color: #4a4845;">
                  Cheers! 🥂 &nbsp;—&nbsp; The Drinks Bot Team
                </p>

              </div>

              <!-- Gold bottom bar -->
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(201,144,58,0.3), transparent);"></div>

            </div>

          </div>
        </body>
        </html>
      `
    };

    console.log('Sending email...');
    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${email}:`, result.messageId);
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    console.error('Error details:', {
      code: error.code,
      command: error.command,
      response: error.response
    });
  }
}

// IP filtering middleware
function checkIPAccess(req, res, next) {
  let clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Handle proxy headers (for nginx reverse proxy)
  if (req.headers['x-forwarded-for']) {
    clientIP = req.headers['x-forwarded-for'].split(',')[0].trim();
  }
  if (req.headers['x-real-ip']) {
    clientIP = req.headers['x-real-ip'];
  }
  
  // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
  if (clientIP.startsWith('::ffff:')) {
    clientIP = clientIP.substring(7);
  }
  
  // Check against database restrictions
  db.all('SELECT * FROM ip_restrictions WHERE enabled = 1', [], (err, restrictions) => {
    if (err) {
      console.error('Error checking IP restrictions:', err);
      return next(); // Allow access on database error
    }
    
    // Check if client IP matches any enabled restriction
    for (const restriction of restrictions) {
      const [subnetIP, prefixLength] = restriction.subnet.split('/');
      if (isIPInSubnet(clientIP, subnetIP, parseInt(prefixLength))) {
        console.log(`🚫 Blocked access from ${clientIP} - matches restriction: ${restriction.subnet} (${restriction.description})`);
        return res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Drinks Bot - See You Soon!</title>
              <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍹</text></svg>">
              <style>
                  * {
                      margin: 0;
                      padding: 0;
                      box-sizing: border-box;
                      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
                  }
                  body {
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      min-height: 100vh;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 20px;
                      margin: 0;
                  }
                  .container {
                      background: rgba(255, 255, 255, 0.95);
                      backdrop-filter: blur(10px);
                      border-radius: 20px;
                      padding: 60px 40px;
                      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                      text-align: center;
                      max-width: 600px;
                      width: 100%;
                  }
                  .emoji {
                      font-size: 4em;
                      margin-bottom: 20px;
                      display: block;
                  }
                  h1 {
                      color: #333;
                      font-size: 2.5em;
                      font-weight: 300;
                      margin-bottom: 20px;
                  }
                  p {
                      color: #666;
                      font-size: 1.3em;
                      line-height: 1.6;
                      margin-bottom: 30px;
                  }
                  .wave {
                      font-size: 2em;
                      margin-top: 20px;
                  }
                  @media (max-width: 768px) {
                      .container {
                          padding: 40px 30px;
                      }
                      h1 {
                          font-size: 2em;
                      }
                      p {
                          font-size: 1.1em;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <span class="emoji">🍹</span>
                  <h1>Thanks for taking part this summer</h1>
                  <p>The drinks bot will return!</p>
                  <span class="wave">👋</span>
              </div>
          </body>
          </html>
        `);
      }
    }
    
    // Allow access if no restrictions match
    next();
  });
}

// Function to check if IP is in subnet
function isIPInSubnet(ip, subnetIP, prefixLength) {
  try {
    const ipToNumber = (ip) => {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    };
    
    const ipNum = ipToNumber(ip);
    const subnetNum = ipToNumber(subnetIP);
    const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
    
    return (ipNum & mask) === (subnetNum & mask);
  } catch (error) {
    console.error('Error checking IP subnet:', error);
    return false;
  }
}

app.use(cors());
app.use(express.json());

// Apply IP filtering BEFORE static files
app.use(checkIPAccess);

app.use(express.static('public'));

const dbPath = path.join(__dirname, 'data', 'orders.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    drink TEXT NOT NULL,
    email TEXT,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create IP restrictions table
  db.run(`CREATE TABLE IF NOT EXISTS ip_restrictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subnet TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create settings table for app configuration
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Create drinks table
  db.run(`CREATE TABLE IF NOT EXISTS drinks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Add default festive theme setting if not exists
  db.get('SELECT value FROM settings WHERE key = ?', ['festive_theme'], (err, row) => {
    if (!row) {
      db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['festive_theme', 'false'], (err) => {
        if (!err) console.log('Added festive theme setting (default: off)');
      });
    }
  });
  
  // Populate default drinks if table is empty
  db.get('SELECT COUNT(*) as count FROM drinks', [], (err, row) => {
    if (!err && row.count === 0) {
      const defaultDrinks = [
        'Camden Hells',
        'Champagne',
        'Coke',
        'Gin & Tonic',
        'Koppaberg',
        'Lemonade',
        'Nightcap',
        'Peroni',
        'Tango Orange',
        'Tea',
        'Water',
        'White Wine',
        '0% Guinness',
        '0% Peroni'
      ];
      
      const stmt = db.prepare('INSERT INTO drinks (name, sort_order) VALUES (?, ?)');
      defaultDrinks.sort().forEach((drink, index) => {
        stmt.run([drink, index]);
      });
      stmt.finalize(() => {
        console.log(`Added ${defaultDrinks.length} default drinks to database`);
      });
    }
  });
  
  // Add default restriction if none exist
  db.get('SELECT COUNT(*) as count FROM ip_restrictions', [], (err, row) => {
    if (!err && row.count === 0) {
      db.run('INSERT INTO ip_restrictions (subnet, description, enabled) VALUES (?, ?, ?)', 
        ['172.16.10.0/23', 'Default summer restriction', 1], (err) => {
          if (!err) console.log('Added default IP restriction: 172.16.10.0/23');
        });
    }
  });
  
  // Add new columns if they don't exist
  db.run(`ALTER TABLE orders ADD COLUMN email TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('Note: email column may already exist');
    }
  });
  
  db.run(`ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'pending'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('Note: status column may already exist');
    }
  });
  
  // Migrate existing orders from completed boolean to status
  db.run(`UPDATE orders SET status = 'completed' WHERE completed = 1 AND (status IS NULL OR status = '')`, (err) => {
    if (!err) console.log('Migrated completed orders to new status system');
  });
  
  db.run(`UPDATE orders SET status = 'pending' WHERE completed = 0 AND (status IS NULL OR status = '')`, (err) => {
    if (!err) console.log('Migrated pending orders to new status system');
  });
  
  // For any orders that don't have the completed column, set default status
  db.run(`UPDATE orders SET status = 'pending' WHERE status IS NULL OR status = ''`, (err) => {
    if (!err) console.log('Set default status for any remaining orders');
  });
});

app.get('/api/drinks', (req, res) => {
  db.all('SELECT * FROM drinks ORDER BY sort_order, name', [], (err, rows) => {
    if (err) {
      console.error('Error getting drinks:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Return just the drink names for the frontend
    const drinkNames = rows.map(row => row.name);
    res.json(drinkNames);
  });
});
async function sendSlackNotification(name, drink) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('Slack webhook URL not configured, skipping notification');
    return;
  }

  const message = {
    text: `🍹 *Drinks Request*\n*Name:* ${name}\n*Drink:* ${drink}`
  };

  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      console.log('Slack notification sent successfully');
    } else {
      console.error('Failed to send Slack notification:', response.statusText);
    }
  } catch (error) {
    console.error('Error sending Slack notification:', error);
  }
}

app.get('/api/drinks', (req, res) => {
  res.json(AVAILABLE_DRINKS);
});

app.post('/api/orders', (req, res) => {
  const { name, drink, email } = req.body;
  
  if (!name || !drink) {
    return res.status(400).json({ error: 'Name and drink are required' });
  }

  const stmt = db.prepare('INSERT INTO orders (name, drink, email, status) VALUES (?, ?, ?, ?)');
  stmt.run([name, drink, email || null, 'pending'], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Send Slack notification (async, don't wait for it)
    sendSlackNotification(name, drink).catch(console.error);

    res.json({ 
      id: this.lastID, 
      message: 'Order submitted successfully',
      name,
      drink 
    });
  });
  stmt.finalize();
});

app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY timestamp DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get ready orders for status page
app.get('/api/orders/ready', (req, res) => {
  db.all("SELECT * FROM orders WHERE status = 'ready' ORDER BY timestamp ASC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get specific order by ID
app.get('/api/orders/:id', (req, res) => {
  const orderId = req.params.id;
  
  if (!orderId || isNaN(orderId)) {
    return res.status(400).json({ error: 'Valid order ID is required' });
  }
  
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      console.error('Error getting order:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  });
});

// Mark order as ready
app.put('/api/orders/:id/ready', (req, res) => {
  const orderId = req.params.id;
  
  // First get the order details for email notification
  db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, order) => {
    if (err) {
      console.error('Database error getting order:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update status to ready
    db.run("UPDATE orders SET status = ? WHERE id = ?", ['ready', orderId], function(err) {
      if (err) {
        console.error('Database error updating order:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Order not found or not updated' });
      }

      console.log(`Order ${orderId} marked as ready`);

      // Send email notification if email was provided
      if (order.email) {
        sendEmailNotification(order.email, order.name, order.drink).catch(console.error);
      }

      res.json({ message: 'Order marked as ready' });
    });
  });
});

// Mark order as complete
app.put('/api/orders/:id/complete', (req, res) => {
  const orderId = req.params.id;
  
  db.run("UPDATE orders SET status = ? WHERE id = ?", ['completed', orderId], function(err) {
    if (err) {
      console.error('Database error updating order:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Order not found or not updated' });
    }
    
    console.log(`Order ${orderId} marked as completed`);
    res.json({ message: 'Order marked as complete' });
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin API endpoints

// Get all drinks with full details (for admin)
app.get('/api/admin/drinks', (req, res) => {
  db.all('SELECT * FROM drinks ORDER BY sort_order, name', [], (err, rows) => {
    if (err) {
      console.error('Error getting drinks:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new drink
app.post('/api/admin/drinks', (req, res) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Drink name is required' });
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'Drink name cannot be empty' });
  }

  // Get the current max sort_order
  db.get('SELECT MAX(sort_order) as max_order FROM drinks', [], (err, row) => {
    if (err) {
      console.error('Error getting max sort order:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const nextOrder = (row.max_order || 0) + 1;
    
    db.run('INSERT INTO drinks (name, sort_order) VALUES (?, ?)', [trimmedName, nextOrder], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Drink already exists' });
        }
        console.error('Error adding drink:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Added drink: ${trimmedName}`);
      res.json({ 
        id: this.lastID,
        message: 'Drink added successfully',
        name: trimmedName
      });
    });
  });
});

// Delete drink
app.delete('/api/admin/drinks/:id', (req, res) => {
  const drinkId = req.params.id;
  
  // Get drink details for logging
  db.get('SELECT * FROM drinks WHERE id = ?', [drinkId], (err, drink) => {
    if (err) {
      console.error('Error getting drink:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    db.run('DELETE FROM drinks WHERE id = ?', [drinkId], function(err) {
      if (err) {
        console.error('Error deleting drink:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Deleted drink: ${drink.name}`);
      res.json({ 
        message: 'Drink deleted successfully',
        name: drink.name
      });
    });
  });
});

// Purge old orders
app.delete('/api/admin/orders/purge', (req, res) => {
  const { days } = req.body;
  
  if (!days || isNaN(days) || days < 1) {
    return res.status(400).json({ error: 'Valid number of days is required' });
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffTimestamp = cutoffDate.toISOString();

  const stmt = db.prepare('DELETE FROM orders WHERE timestamp < ?');
  stmt.run([cutoffTimestamp], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ 
      message: `Purged ${this.changes} orders older than ${days} days`,
      deletedCount: this.changes 
    });
  });
  stmt.finalize();
});

// Delete specific order IDs
app.delete('/api/admin/orders/specific', (req, res) => {
  const { orderIds } = req.body;
  
  if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'Valid order IDs array is required' });
  }

  // Validate all IDs are numbers
  const validIds = orderIds.filter(id => Number.isInteger(id) && id > 0);
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'No valid order IDs provided' });
  }

  const placeholders = validIds.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM orders WHERE id IN (${placeholders})`);
  
  stmt.run(validIds, function(err) {
    if (err) {
      console.error('Error deleting specific orders:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`Deleted ${this.changes} specific orders: ${validIds.join(', ')}`);
    res.json({ 
      message: `Successfully deleted ${this.changes} orders (IDs: ${validIds.join(', ')})`,
      deletedCount: this.changes,
      requestedIds: orderIds,
      deletedIds: validIds
    });
  });
  stmt.finalize();
});

// Get database stats
app.get('/api/admin/stats', (req, res) => {
  db.get('SELECT COUNT(*) as total FROM orders', [], (err, totalRow) => {
    if (err) {
      console.error('Error getting total count:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    db.get('SELECT COUNT(*) as pending FROM orders WHERE status = ?', ['pending'], (err, pendingRow) => {
      if (err) {
        console.error('Error getting pending count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.get('SELECT COUNT(*) as ready FROM orders WHERE status = ?', ['ready'], (err, readyRow) => {
        if (err) {
          console.error('Error getting ready count:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        db.get('SELECT COUNT(*) as completed FROM orders WHERE status = ?', ['completed'], (err, completedRow) => {
          if (err) {
            console.error('Error getting completed count:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          const stats = {
            total: totalRow.total,
            pending: pendingRow.pending,
            ready: readyRow.ready,
            completed: completedRow.completed
          };
          
          console.log('Admin stats:', stats);
          res.json(stats);
        });
      });
    });
  });
});

// IP Restrictions management endpoints

// Get all IP restrictions
app.get('/api/admin/ip-restrictions', (req, res) => {
  db.all('SELECT * FROM ip_restrictions ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Error getting IP restrictions:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new IP restriction
app.post('/api/admin/ip-restrictions', (req, res) => {
  const { subnet, description } = req.body;
  
  if (!subnet) {
    return res.status(400).json({ error: 'Subnet is required' });
  }
  
  // Basic subnet validation
  const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!subnetRegex.test(subnet)) {
    return res.status(400).json({ error: 'Invalid subnet format. Use CIDR notation (e.g., 192.168.1.0/24)' });
  }
  
  const stmt = db.prepare('INSERT INTO ip_restrictions (subnet, description, enabled) VALUES (?, ?, ?)');
  stmt.run([subnet, description || '', 1], function(err) {
    if (err) {
      console.error('Error adding IP restriction:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`Added IP restriction: ${subnet} (${description})`);
    res.json({ 
      id: this.lastID,
      message: 'IP restriction added successfully',
      subnet,
      description
    });
  });
  stmt.finalize();
});

// Toggle IP restriction enabled/disabled
app.put('/api/admin/ip-restrictions/:id/toggle', (req, res) => {
  const restrictionId = req.params.id;
  
  // First get current state
  db.get('SELECT * FROM ip_restrictions WHERE id = ?', [restrictionId], (err, restriction) => {
    if (err) {
      console.error('Error getting IP restriction:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!restriction) {
      return res.status(404).json({ error: 'IP restriction not found' });
    }
    
    const newEnabled = restriction.enabled ? 0 : 1;
    
    db.run('UPDATE ip_restrictions SET enabled = ? WHERE id = ?', [newEnabled, restrictionId], function(err) {
      if (err) {
        console.error('Error toggling IP restriction:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const action = newEnabled ? 'enabled' : 'disabled';
      console.log(`${action} IP restriction: ${restriction.subnet}`);
      res.json({ 
        message: `IP restriction ${action} successfully`,
        enabled: newEnabled
      });
    });
  });
});

// Delete IP restriction
app.delete('/api/admin/ip-restrictions/:id', (req, res) => {
  const restrictionId = req.params.id;
  
  // First get restriction details for logging
  db.get('SELECT * FROM ip_restrictions WHERE id = ?', [restrictionId], (err, restriction) => {
    if (err) {
      console.error('Error getting IP restriction:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!restriction) {
      return res.status(404).json({ error: 'IP restriction not found' });
    }
    
    db.run('DELETE FROM ip_restrictions WHERE id = ?', [restrictionId], function(err) {
      if (err) {
        console.error('Error deleting IP restriction:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Deleted IP restriction: ${restriction.subnet} (${restriction.description})`);
      res.json({ 
        message: 'IP restriction deleted successfully',
        subnet: restriction.subnet
      });
    });
  });
});

// Drinks management endpoints

// Get all drinks with full details (for admin)
app.get('/api/admin/drinks', (req, res) => {
  db.all('SELECT * FROM drinks ORDER BY sort_order, name', [], (err, rows) => {
    if (err) {
      console.error('Error getting drinks:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new drink
app.post('/api/admin/drinks', (req, res) => {
  const { name } = req.body;
  
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Drink name is required' });
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'Drink name cannot be empty' });
  }

  // Get the current max sort_order
  db.get('SELECT MAX(sort_order) as max_order FROM drinks', [], (err, row) => {
    if (err) {
      console.error('Error getting max sort order:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const nextOrder = (row.max_order || 0) + 1;
    
    db.run('INSERT INTO drinks (name, sort_order) VALUES (?, ?)', [trimmedName, nextOrder], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Drink already exists' });
        }
        console.error('Error adding drink:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Added drink: ${trimmedName}`);
      res.json({ 
        id: this.lastID,
        message: 'Drink added successfully',
        name: trimmedName
      });
    });
  });
});

// Delete drink
app.delete('/api/admin/drinks/:id', (req, res) => {
  const drinkId = req.params.id;
  
  // Get drink details for logging
  db.get('SELECT * FROM drinks WHERE id = ?', [drinkId], (err, drink) => {
    if (err) {
      console.error('Error getting drink:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!drink) {
      return res.status(404).json({ error: 'Drink not found' });
    }
    
    db.run('DELETE FROM drinks WHERE id = ?', [drinkId], function(err) {
      if (err) {
        console.error('Error deleting drink:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Deleted drink: ${drink.name}`);
      res.json({ 
        message: 'Drink deleted successfully',
        name: drink.name
      });
    });
  });
});

// Settings management endpoints

// Get all settings
app.get('/api/settings', (req, res) => {
  db.all('SELECT * FROM settings', [], (err, rows) => {
    if (err) {
      console.error('Error getting settings:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Convert to key-value object
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json(settings);
  });
});

// Update setting
app.put('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (!value) {
    return res.status(400).json({ error: 'Value is required' });
  }
  
  db.run(
    'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
    [key, value],
    function(err) {
      if (err) {
        console.error('Error updating setting:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      console.log(`Updated setting: ${key} = ${value}`);
      res.json({ key, value, message: 'Setting updated successfully' });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  if (SLACK_WEBHOOK_URL) {
    console.log('Slack notifications enabled');
  } else {
    console.log('Slack notifications disabled (no webhook URL provided)');
  }
});

process.on('SIGTERM', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    console.log('Database connection closed.');
  });
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
