# Approval Food Menu API Documentation

## Overview
The Approval Food Menu API provides comprehensive functionality for managing food menu approval requests from users. Users can submit food menu plans for approval, and gym admins can review, approve, or reject these requests.

## Base URL
```
http://localhost:5000/api/approvalFoodMenu
```

## Authentication
All endpoints require authentication with a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Data Structure

### Approval Food Menu Request Object
```json
{
  "id": 1,
  "gym_id": 1,
  "user_id": 123,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "contact": "+1234567890",
  "menu_plan_category": "Muscle building",
  "total_days": 30,
  "description": "High protein diet for muscle building",
  "food_items": [
    {
      "food_item_name": "Grilled Chicken Breast",
      "grams": 200,
      "protein": 46.0,
      "fats": 5.0,
      "carbs": 0.0,
      "calories": 220
    },
    {
      "food_item_name": "Brown Rice",
      "grams": 150,
      "protein": 4.5,
      "fats": 1.8,
      "carbs": 35.0,
      "calories": 170
    }
  ],
  "total_protein": 50.5,
  "total_fats": 6.8,
  "total_carbs": 35.0,
  "total_calories": 390,
  "approval_status": "PENDING",
  "approval_notes": null,
  "approved_by": null,
  "approved_at": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Menu Plan Categories
- `Weight Gain`
- `Weight Lose`
- `Muscle building`

### Approval Status Values
- `PENDING` - Request is waiting for approval
- `APPROVED` - Request has been approved
- `REJECTED` - Request has been rejected

### Food Item Structure
```json
{
  "food_item_name": "Grilled Chicken Breast",
  "grams": 200,
  "protein": 46.0,
  "fats": 5.0,
  "carbs": 0.0,
  "calories": 220
}
```

## API Endpoints

### 1. List All Approval Requests
**GET** `/api/approvalFoodMenu`

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)
- `status` (optional): Filter by approval status (PENDING/APPROVED/REJECTED)
- `category` (optional): Filter by menu plan category
- `start_date` (optional): Filter by creation date (YYYY-MM-DD)
- `end_date` (optional): Filter by creation date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john.doe@example.com",
      "contact": "+1234567890",
      "menu_plan_category": "Muscle building",
      "total_days": 30,
      "approval_status": "PENDING",
      "total_calories": 390,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

### 2. Get Single Approval Request
**GET** `/api/approvalFoodMenu/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "contact": "+1234567890",
    "menu_plan_category": "Muscle building",
    "total_days": 30,
    "description": "High protein diet for muscle building",
    "food_items": [
      {
        "food_item_name": "Grilled Chicken Breast",
        "grams": 200,
        "protein": 46.0,
        "fats": 5.0,
        "carbs": 0.0,
        "calories": 220
      }
    ],
    "total_protein": 50.5,
    "total_fats": 6.8,
    "total_carbs": 35.0,
    "total_calories": 390,
    "approval_status": "PENDING",
    "approval_notes": null,
    "approved_by": null,
    "approved_at": null
  }
}
```

### 3. Create New Approval Request
**POST** `/api/approvalFoodMenu`

**Request Body:**
```json
{
  "user_id": 123,
  "name": "John Doe",
  "email": "john.doe@example.com",
  "contact": "+1234567890",
  "menu_plan_category": "Muscle building",
  "total_days": 30,
  "description": "High protein diet for muscle building",
  "food_items": [
    {
      "food_item_name": "Grilled Chicken Breast",
      "grams": 200,
      "protein": 46.0,
      "fats": 5.0,
      "carbs": 0.0,
      "calories": 220
    },
    {
      "food_item_name": "Brown Rice",
      "grams": 150,
      "protein": 4.5,
      "fats": 1.8,
      "carbs": 35.0,
      "calories": 170
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "contact": "+1234567890",
    "menu_plan_category": "Muscle building",
    "total_days": 30,
    "description": "High protein diet for muscle building",
    "food_items": [...],
    "total_protein": 50.5,
    "total_fats": 6.8,
    "total_carbs": 35.0,
    "total_calories": 390,
    "approval_status": "PENDING"
  },
  "message": "Approval food menu request created successfully"
}
```

### 4. Update Approval Request
**PUT** `/api/approvalFoodMenu/:id`

**Note:** Can only update requests with status "PENDING"

**Request Body:** (All fields optional)
```json
{
  "name": "John Smith",
  "email": "john.smith@example.com",
  "contact": "+1234567891",
  "menu_plan_category": "Weight Gain",
  "total_days": 45,
  "description": "Updated description",
  "food_items": [...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Smith",
    "email": "john.smith@example.com",
    "contact": "+1234567891",
    "menu_plan_category": "Weight Gain",
    "total_days": 45,
    "description": "Updated description",
    "food_items": [...],
    "total_protein": 60.0,
    "total_fats": 8.0,
    "total_carbs": 40.0,
    "total_calories": 450,
    "approval_status": "PENDING"
  },
  "message": "Approval food menu request updated successfully"
}
```

### 5. Delete Approval Request
**DELETE** `/api/approvalFoodMenu/:id`

**Response:**
```json
{
  "success": true,
  "message": "Approval food menu request deleted successfully"
}
```

### 6. Update Approval Status
**PATCH** `/api/approvalFoodMenu/:id/approval`

**Request Body:**
```json
{
  "approval_status": "APPROVED",
  "approval_notes": "Great meal plan! Approved for implementation."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "approval_status": "APPROVED",
    "approval_notes": "Great meal plan! Approved for implementation.",
    "approved_by": 1,
    "approved_at": "2024-01-01T12:00:00.000Z",
    "name": "John Doe",
    "email": "john.doe@example.com",
    "menu_plan_category": "Muscle building"
  },
  "message": "Approval food menu request approved successfully"
}
```

### 7. Get Available Categories
**GET** `/api/approvalFoodMenu/categories`

**Response:**
```json
{
  "success": true,
  "data": [
    "Weight Gain",
    "Weight Lose",
    "Muscle building"
  ]
}
```

### 8. Get Approval Statistics
**GET** `/api/approvalFoodMenu/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 25,
    "pending": 10,
    "approved": 12,
    "rejected": 3
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "name, email, contact, menu_plan_category, and food_items are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Access denied. No token provided."
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Approval food menu request not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Features

### Automatic Nutrition Calculation
The API automatically calculates total nutrition values from food items:
- `total_protein`: Sum of all protein from food items
- `total_fats`: Sum of all fats from food items
- `total_carbs`: Sum of all carbs from food items
- `total_calories`: Sum of all calories from food items

### Data Validation
- Menu plan category must be one of: "Weight Gain", "Weight Lose", "Muscle building"
- Approval status must be: "PENDING", "APPROVED", or "REJECTED"
- Required fields: name, email, contact, menu_plan_category, food_items
- Food items must be a non-empty array with required fields
- Cannot update requests that are already approved or rejected

### Security
- All endpoints require gym admin authentication
- Data is scoped by gym_id to ensure proper access control
- JWT token validation on all requests

## Usage Examples

### Create a Weight Loss Menu Approval Request
```bash
curl -X POST http://localhost:5000/api/approvalFoodMenu \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Smith",
    "email": "jane.smith@example.com",
    "contact": "+1234567890",
    "menu_plan_category": "Weight Lose",
    "total_days": 30,
    "description": "Low calorie diet for weight loss",
    "food_items": [
      {
        "food_item_name": "Grilled Fish",
        "grams": 150,
        "protein": 35.0,
        "fats": 3.0,
        "carbs": 0.0,
        "calories": 180
      },
      {
        "food_item_name": "Steamed Vegetables",
        "grams": 200,
        "protein": 5.0,
        "fats": 1.0,
        "carbs": 15.0,
        "calories": 90
      }
    ]
  }'
```

### Get All Pending Requests
```bash
curl -X GET "http://localhost:5000/api/approvalFoodMenu?status=PENDING" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Approve a Request
```bash
curl -X PATCH http://localhost:5000/api/approvalFoodMenu/1/approval \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_status": "APPROVED",
    "approval_notes": "Excellent meal plan with balanced nutrition!"
  }'
```

### Reject a Request
```bash
curl -X PATCH http://localhost:5000/api/approvalFoodMenu/1/approval \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approval_status": "REJECTED",
    "approval_notes": "Please add more protein sources and reduce processed foods."
  }'
```

### Get Approval Statistics
```bash
curl -X GET http://localhost:5000/api/approvalFoodMenu/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
