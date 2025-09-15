# Food Menu API Documentation

## Overview
The Food Menu API provides comprehensive functionality for managing gym food menus with detailed nutritional information for breakfast, lunch, and dinner meals.

## Base URL
```
http://localhost:5000/api/foodMenu
```

## Authentication
All endpoints require authentication with a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Data Structure

### Food Menu Object
```json
{
  "id": 1,
  "gym_id": 1,
  "menu_plan_category": "Muscle building",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "breakfast": [
    {
      "food_item_name": "Oatmeal with Banana",
      "grams": 150,
      "protein": 12.5,
      "fats": 8.2,
      "carbs": 45.3,
      "total_calories": 280
    }
  ],
  "lunch": [
    {
      "food_item_name": "Grilled Chicken Breast",
      "grams": 200,
      "protein": 46.0,
      "fats": 5.0,
      "carbs": 0.0,
      "total_calories": 220
    }
  ],
  "dinner": [
    {
      "food_item_name": "Salmon Fillet",
      "grams": 180,
      "protein": 36.0,
      "fats": 12.0,
      "carbs": 0.0,
      "total_calories": 250
    }
  ],
  "total_daily_protein": 122.1,
  "total_daily_fats": 32.3,
  "total_daily_carbs": 139.3,
  "total_daily_calories": 1330,
  "status": "ACTIVE",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Menu Plan Categories
- `Weight Gain`
- `Weight Lose`
- `Muscle building`

### Status Values
- `ACTIVE`
- `INACTIVE`

## API Endpoints

### 1. List All Food Menus
**GET** `/api/foodMenu`

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of items per page (default: 20)
- `category` (optional): Filter by menu plan category
- `status` (optional): Filter by status (ACTIVE/INACTIVE)
- `start_date` (optional): Filter by start date (YYYY-MM-DD)
- `end_date` (optional): Filter by end date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "menu_plan_category": "Muscle building",
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "total_daily_calories": 1330,
      "status": "ACTIVE",
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

### 2. Get Single Food Menu
**GET** `/api/foodMenu/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "menu_plan_category": "Muscle building",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "breakfast": [...],
    "lunch": [...],
    "dinner": [...],
    "total_daily_protein": 122.1,
    "total_daily_fats": 32.3,
    "total_daily_carbs": 139.3,
    "total_daily_calories": 1330,
    "status": "ACTIVE"
  }
}
```

### 3. Create New Food Menu
**POST** `/api/foodMenu`

**Request Body:**
```json
{
  "menu_plan_category": "Muscle building",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "breakfast": [
    {
      "food_item_name": "Oatmeal with Banana",
      "grams": 150,
      "protein": 12.5,
      "fats": 8.2,
      "carbs": 45.3,
      "total_calories": 280
    }
  ],
  "lunch": [
    {
      "food_item_name": "Grilled Chicken Breast",
      "grams": 200,
      "protein": 46.0,
      "fats": 5.0,
      "carbs": 0.0,
      "total_calories": 220
    }
  ],
  "dinner": [
    {
      "food_item_name": "Salmon Fillet",
      "grams": 180,
      "protein": 36.0,
      "fats": 12.0,
      "carbs": 0.0,
      "total_calories": 250
    }
  ],
  "status": "ACTIVE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "menu_plan_category": "Muscle building",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "breakfast": [...],
    "lunch": [...],
    "dinner": [...],
    "total_daily_protein": 122.1,
    "total_daily_fats": 32.3,
    "total_daily_carbs": 139.3,
    "total_daily_calories": 1330,
    "status": "ACTIVE"
  },
  "message": "Food menu created successfully"
}
```

### 4. Update Food Menu
**PUT** `/api/foodMenu/:id`

**Request Body:** (All fields optional)
```json
{
  "menu_plan_category": "Weight Gain",
  "start_date": "2024-02-01",
  "end_date": "2024-02-28",
  "breakfast": [...],
  "lunch": [...],
  "dinner": [...],
  "status": "INACTIVE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "menu_plan_category": "Weight Gain",
    "start_date": "2024-02-01",
    "end_date": "2024-02-28",
    "breakfast": [...],
    "lunch": [...],
    "dinner": [...],
    "total_daily_protein": 150.0,
    "total_daily_fats": 40.0,
    "total_daily_carbs": 200.0,
    "total_daily_calories": 1800,
    "status": "INACTIVE"
  },
  "message": "Food menu updated successfully"
}
```

### 5. Delete Food Menu
**DELETE** `/api/foodMenu/:id`

**Response:**
```json
{
  "success": true,
  "message": "Food menu deleted successfully"
}
```

### 6. Update Food Menu Status
**PATCH** `/api/foodMenu/:id/status`

**Request Body:**
```json
{
  "status": "INACTIVE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "INACTIVE",
    "menu_plan_category": "Muscle building",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  },
  "message": "Food menu status updated successfully"
}
```

### 7. Get Available Categories
**GET** `/api/foodMenu/categories`

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

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "menu_plan_category, start_date, and end_date are required"
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
  "message": "Food menu not found"
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
The API automatically calculates total daily nutrition values:
- `total_daily_protein`: Sum of all protein from breakfast, lunch, and dinner
- `total_daily_fats`: Sum of all fats from breakfast, lunch, and dinner
- `total_daily_carbs`: Sum of all carbs from breakfast, lunch, and dinner
- `total_daily_calories`: Sum of all calories from breakfast, lunch, and dinner

### Data Validation
- Menu plan category must be one of: "Weight Gain", "Weight Lose", "Muscle building"
- Status must be either "ACTIVE" or "INACTIVE"
- Required fields: menu_plan_category, start_date, end_date
- All nutrition values are stored as decimal numbers for precision

### Security
- All endpoints require gym admin authentication
- Data is scoped by gym_id to ensure proper access control
- JWT token validation on all requests

## Usage Examples

### Create a Weight Loss Menu
```bash
curl -X POST http://localhost:5000/api/foodMenu \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_plan_category": "Weight Lose",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "breakfast": [
      {
        "food_item_name": "Green Smoothie",
        "grams": 300,
        "protein": 8.0,
        "fats": 2.0,
        "carbs": 25.0,
        "total_calories": 150
      }
    ],
    "lunch": [
      {
        "food_item_name": "Grilled Fish",
        "grams": 150,
        "protein": 35.0,
        "fats": 3.0,
        "carbs": 0.0,
        "total_calories": 180
      }
    ],
    "dinner": [
      {
        "food_item_name": "Vegetable Salad",
        "grams": 200,
        "protein": 5.0,
        "fats": 1.0,
        "carbs": 15.0,
        "total_calories": 90
      }
    ]
  }'
```

### Get All Active Menus
```bash
curl -X GET "http://localhost:5000/api/foodMenu?status=ACTIVE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Menu Status
```bash
curl -X PATCH http://localhost:5000/api/foodMenu/1/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "INACTIVE"}'
```
