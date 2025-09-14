# Payment Status API Documentation

## Overview
This API provides comprehensive payment management functionality for gym administrators, including tracking payment status, managing payment records, and sending WhatsApp reminders.

## Base URL
```
http://localhost:5000/api/paymentStatus
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Payment Overview
**GET** `/overview`

Returns summary statistics including total amount, paid/unpaid member counts, and all payment records.

**Response:**
```json
{
  "success": true,
  "data": {
    "total_amount": 1250.00,
    "paid_members": 15,
    "unpaid_members": 8,
    "all_payments": [
      {
        "id": 1,
        "amount": "50.00",
        "payment_status": "Paid",
        "payment_date": "2024-01-10T00:00:00.000Z",
        "due_date": "2024-01-15",
        "created_at": "2024-01-08T10:30:00.000Z",
        "updated_at": "2024-01-10T14:20:00.000Z",
        "user_name": "John Doe",
        "user_email": "john@example.com",
        "user_phone": "+1234567890"
      }
    ]
  }
}
```

### 2. Get All Payment Records
**GET** `/`

Retrieves paginated list of payment records with optional filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Records per page (default: 10)
- `status` (optional): Filter by payment status ("Paid" or "Unpaid")
- `search` (optional): Search by user name, email, or phone

**Example:**
```
GET /api/paymentStatus?page=1&limit=5&status=Unpaid&search=john
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "amount": "50.00",
        "payment_status": "Unpaid",
        "payment_date": null,
        "due_date": "2024-01-20",
        "created_at": "2024-01-08T10:30:00.000Z",
        "updated_at": "2024-01-08T10:30:00.000Z",
        "user_name": "John Doe",
        "user_email": "john@example.com",
        "user_phone": "+1234567890"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_records": 23,
      "limit": 10
    }
  }
}
```

### 3. Get Single Payment Record
**GET** `/:id`

Retrieves a specific payment record by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "amount": "50.00",
    "payment_status": "Paid",
    "payment_date": "2024-01-10T00:00:00.000Z",
    "due_date": "2024-01-15",
    "created_at": "2024-01-08T10:30:00.000Z",
    "updated_at": "2024-01-10T14:20:00.000Z",
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "user_phone": "+1234567890"
  }
}
```

### 4. Create Payment Record
**POST** `/`

Creates a new payment record.

**Request Body:**
```json
{
  "user_id": 1,
  "amount": 75.00,
  "payment_status": "Unpaid",
  "due_date": "2024-01-25"
}
```

**Required Fields:**
- `user_id`: ID of the user
- `amount`: Payment amount (decimal)
- `payment_status`: Either "Paid" or "Unpaid"

**Optional Fields:**
- `due_date`: Due date for the payment (YYYY-MM-DD format)

**Response:**
```json
{
  "success": true,
  "message": "Payment record created successfully",
  "data": {
    "id": 5,
    "user_id": 1,
    "gym_id": 1,
    "amount": "75.00",
    "payment_status": "Unpaid",
    "payment_date": null,
    "due_date": "2024-01-25",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. Update Payment Record
**PUT** `/:id`

Updates an existing payment record.

**Request Body:**
```json
{
  "amount": 80.00,
  "payment_status": "Paid",
  "due_date": "2024-01-30"
}
```

**Note:** All fields are optional. If `payment_status` is changed to "Paid", `payment_date` is automatically set to the current timestamp.

**Response:**
```json
{
  "success": true,
  "message": "Payment record updated successfully",
  "data": {
    "id": 5,
    "user_id": 1,
    "gym_id": 1,
    "amount": "80.00",
    "payment_status": "Paid",
    "payment_date": "2024-01-15T14:20:00.000Z",
    "due_date": "2024-01-30",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T14:20:00.000Z"
  }
}
```

### 6. Delete Payment Record
**DELETE** `/:id`

Deletes a payment record.

**Response:**
```json
{
  "success": true,
  "message": "Payment record deleted successfully"
}
```

### 7. Send WhatsApp Reminders (All Unpaid)
**POST** `/whatsapp-reminder`

Sends WhatsApp reminders to all unpaid members.

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp reminders prepared for 8 unpaid members",
  "data": {
    "reminders_sent": 8,
    "reminders": [
      {
        "id": 1,
        "name": "John Doe",
        "phone": "+1234567890",
        "amount": "50.00",
        "due_date": "2024-01-20",
        "message": "Hi John Doe, this is a reminder that your payment of $50.00 is due on 1/20/2024. Please make the payment at your earliest convenience."
      }
    ]
  }
}
```

### 8. Send WhatsApp Reminder (Specific Member)
**POST** `/whatsapp-reminder/:id`

Sends a WhatsApp reminder to a specific member.

**Response:**
```json
{
  "success": true,
  "message": "WhatsApp reminder prepared successfully",
  "data": {
    "id": 1,
    "name": "John Doe",
    "phone": "+1234567890",
    "amount": "50.00",
    "due_date": "2024-01-20",
    "message": "Hi John Doe, this is a reminder that your payment of $50.00 is due on 1/20/2024. Please make the payment at your earliest convenience."
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "User ID, amount, and payment status are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Access denied. Insufficient permissions."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Payment record not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch payment overview"
}
```

## Database Schema

### payment_status Table
```sql
CREATE TABLE payment_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    gym_id INTEGER NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('Paid', 'Unpaid')),
    payment_date TIMESTAMP,
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE
);
```

## Usage Examples

### Frontend Integration Examples

#### 1. Fetch Payment Overview
```javascript
const fetchPaymentOverview = async () => {
  try {
    const response = await fetch('/api/paymentStatus/overview', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching payment overview:', error);
  }
};
```

#### 2. Create Payment Record
```javascript
const createPayment = async (paymentData) => {
  try {
    const response = await fetch('/api/paymentStatus', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentData)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating payment:', error);
  }
};
```

#### 3. Send WhatsApp Reminders
```javascript
const sendWhatsAppReminders = async () => {
  try {
    const response = await fetch('/api/paymentStatus/whatsapp-reminder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending reminders:', error);
  }
};
```

## Notes

1. **WhatsApp Integration**: The WhatsApp reminder endpoints currently return the prepared messages. In a production environment, you would integrate with a WhatsApp Business API to actually send the messages.

2. **Permissions**: All endpoints require either `GYM_ADMIN` or `SUPER_ADMIN` role.

3. **Gym Isolation**: All operations are automatically scoped to the authenticated user's gym.

4. **Automatic Timestamps**: The `payment_date` is automatically set when a payment status is changed to "Paid".

5. **Data Validation**: All input data is validated for required fields and proper formats.

6. **Pagination**: The list endpoint supports pagination for better performance with large datasets.
