# User Management API Documentation

## Overview
The User Management API provides comprehensive functionality for managing gym members/users. It includes statistics, CRUD operations, and user actions like logout.

## Base URL
```
http://localhost:5000/api/userManagement
```

## Authentication
All endpoints require authentication with a valid JWT token and GYM_ADMIN role.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Get User Statistics
**GET** `/stats`

Returns comprehensive statistics about users in the gym.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 25,
    "totalActiveUsers": 20,
    "totalInactiveUsers": 5,
    "totalBasicMemberships": 15,
    "totalPremiumMemberships": 10
  }
}
```

### 2. Get All Users
**GET** `/`

Returns a list of all users in the gym.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890",
      "status": "ACTIVE",
      "membership_tier": "PREMIUM",
      "is_paid": true,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### 3. Get User by ID
**GET** `/:id`

Returns details of a specific user.

**Parameters:**
- `id` (path) - User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "status": "ACTIVE",
    "membership_tier": "PREMIUM",
    "is_paid": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Create User
**POST** `/`

Creates a new user in the gym.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1987654321",
  "password": "password123",
  "status": "ACTIVE",
  "membership_tier": "BASIC"
}
```

**Required Fields:**
- `name` - User's full name
- `email` - User's email address (must be unique)
- `phone` - User's phone number (must be unique)
- `password` - User's password (will be hashed)

**Optional Fields:**
- `status` - User status (ACTIVE/INACTIVE, default: ACTIVE)
- `membership_tier` - Membership type (BASIC/PREMIUM, default: BASIC)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+1987654321",
    "status": "ACTIVE",
    "membership_tier": "BASIC",
    "is_paid": false,
    "created_at": "2024-01-15T11:00:00.000Z"
  },
  "message": "User created successfully"
}
```

### 5. Update User
**PUT** `/:id`

Updates an existing user's information.

**Parameters:**
- `id` (path) - User ID

**Request Body:**
```json
{
  "name": "Jane Smith Updated",
  "email": "jane.updated@example.com",
  "phone": "+1987654322",
  "password": "newpassword123",
  "status": "INACTIVE",
  "membership_tier": "PREMIUM"
}
```

**All fields are optional:**
- `name` - User's full name
- `email` - User's email address (must be unique)
- `phone` - User's phone number (must be unique)
- `password` - User's new password (will be hashed)
- `status` - User status (ACTIVE/INACTIVE)
- `membership_tier` - Membership type (BASIC/PREMIUM)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Jane Smith Updated",
    "email": "jane.updated@example.com",
    "phone": "+1987654322",
    "status": "INACTIVE",
    "membership_tier": "PREMIUM",
    "is_paid": true,
    "updated_at": "2024-01-15T12:00:00.000Z"
  },
  "message": "User updated successfully"
}
```

### 6. Delete User
**DELETE** `/:id`

Permanently deletes a user from the system.

**Parameters:**
- `id` (path) - User ID

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 7. Logout User
**POST** `/:id/logout`

Logs out a user from the mobile app by invalidating their tokens.

**Parameters:**
- `id` (path) - User ID

**Response:**
```json
{
  "success": true,
  "message": "User logged out successfully from mobile app"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Name, email, phone, and password are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. Invalid token."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "User not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to create user"
}
```

## Testing with Postman

### Prerequisites
1. Login as a Gym Admin to get a JWT token
2. Use the token in the Authorization header

### Sample Postman Collection

#### 1. Get User Statistics
```
GET http://localhost:5000/api/userManagement/stats
Headers: Authorization: Bearer <your_jwt_token>
```

#### 2. Create a New User
```
POST http://localhost:5000/api/userManagement/
Headers: 
  Authorization: Bearer <your_jwt_token>
  Content-Type: application/json

Body:
{
  "name": "Test User",
  "email": "test@example.com",
  "phone": "+1234567890",
  "password": "password123",
  "status": "ACTIVE",
  "membership_tier": "BASIC"
}
```

#### 3. Get All Users
```
GET http://localhost:5000/api/userManagement/
Headers: Authorization: Bearer <your_jwt_token>
```

#### 4. Update User
```
PUT http://localhost:5000/api/userManagement/1
Headers: 
  Authorization: Bearer <your_jwt_token>
  Content-Type: application/json

Body:
{
  "status": "INACTIVE",
  "membership_tier": "PREMIUM"
}
```

#### 5. Logout User
```
POST http://localhost:5000/api/userManagement/1/logout
Headers: Authorization: Bearer <your_jwt_token>
```

#### 6. Delete User
```
DELETE http://localhost:5000/api/userManagement/1
Headers: Authorization: Bearer <your_jwt_token>
```

## Features Implemented

✅ **Statistics Dashboard**
- Total Users count
- Active/Inactive user counts
- Basic/Premium membership counts

✅ **User Management**
- Add new users with credentials
- Edit user information
- Update user status and membership
- Delete users

✅ **User Actions**
- Logout users from mobile app
- Token invalidation for security

✅ **Security Features**
- Password hashing with bcrypt
- JWT token authentication
- Role-based access control
- Input validation
- Unique email/phone constraints

✅ **Data Integrity**
- Foreign key constraints
- Proper error handling
- Comprehensive logging
- Transaction safety
