# Drinks Bot 🍹
Simple app to collect, view and manage drinks orders.

Users can request drinks from a dropdown or enter a custom request (but not both in one order)

Orders can be marked as complete from the orders page if they have been delivered, or transitioned to Ready (which will send an email if the user provided one), and display it on the Status page.

When orders are completed they move to the completed section. 

## Pre Reqs
(Optional) - Create Slack webhook url to get notified when new orders come in.

(Optional) - Add some SMTP credentials to .env to allow for emails to be sent when orders are ready. 

Drinks are currently listed in an array in `server.js`, which can be edited before spinning up. 

Long term it might be useful to move this to the database to allow drinks to be added or removed on the fly. 

## Detailed Information
Frontend: HTML/CSS/JavaScript single-page applications

Backend: Node.js with Express.js REST API

Database: SQLite for data persistence

Email: Nodemailer with SMTP support

Containerization: Docker with Docker Compose

## API Overview
Get all orders
```
GET /api/orders
```
Get specific order
```
GET /api/orders/{id}
```
