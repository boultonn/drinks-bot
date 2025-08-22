const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

// Email configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
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
        <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh;">
          <div style="max-width: 500px; margin: 0 auto; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #333; font-size: 2.5em; font-weight: 300; margin: 0;">🍹</h1>
              <h2 style="color: #333; font-size: 1.8em; font-weight: 400; margin: 10px 0;">Your drink is ready!</h2>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; color: #333; font-size: 1.1em;"><strong>Name:</strong> ${name}</p>
              <p style="margin: 10px 0 0 0; color: #333; font-size: 1.1em;"><strong>Drink:</strong> ${drink}</p>
            </div>
            
            <p style="color: #666; text-align: center; font-size: 1.1em; line-height: 1.5; margin: 20px 0;">
              Please come and collect your drink when you're ready!
            </p>
            
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #999; font-size: 0.9em; margin: 0;">
                Cheers! 🥂<br>
                The Drinks Helper Team
              </p>
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

const AVAILABLE_DRINKS = [
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
].sort();

// Function to send Slack notification
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

// Get current drinks list for admin
app.get('/api/admin/drinks', (req, res) => {
  res.json(AVAILABLE_DRINKS);
});

// Add a new drink
app.post('/api/admin/drinks', (req, res) => {
  const { drink } = req.body;
  
  if (!drink || typeof drink !== 'string') {
    return res.status(400).json({ error: 'Drink name is required' });
  }

  const trimmedDrink = drink.trim();
  if (AVAILABLE_DRINKS.includes(trimmedDrink)) {
    return res.status(400).json({ error: 'Drink already exists' });
  }

  AVAILABLE_DRINKS.push(trimmedDrink);
  res.json({ message: 'Drink added successfully', drinks: AVAILABLE_DRINKS });
});

// Remove a drink
app.delete('/api/admin/drinks/:drink', (req, res) => {
  const drinkToRemove = decodeURIComponent(req.params.drink);
  const index = AVAILABLE_DRINKS.indexOf(drinkToRemove);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Drink not found' });
  }

  AVAILABLE_DRINKS.splice(index, 1);
  res.json({ message: 'Drink removed successfully', drinks: AVAILABLE_DRINKS });
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
