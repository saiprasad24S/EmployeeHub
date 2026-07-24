# Skandan API Reference

Base URL: `/api`

## Authentication

All protected endpoints require a Clerk-issued JWT in the `Authorization` header.

### `POST /auth/login`
- Verifies the Clerk session and resolves the user role from the `employees` or `admins` table.
- Returns `ADMIN` or `EMPLOYEE` profile data.

### `POST /auth/logout`
- Client-side logout confirmation endpoint.

## Face

### `POST /face/register`
- Employee-only.
- Multipart form with `selfies[]`.
- Registers the employee face with Azure Face API and stores the Azure person ID in `employees.face_embedding`.

### `POST /face/verify`
- Verifies a live selfie against the registered Azure Face person.

## Attendance

### `POST /attendance/checkin`
- Employee-only.
- Multipart form with `selfie`, `latitude`, `longitude`, `address`, `liveness_score`, `device_identifier`.
- Requires an active assignment and a valid geofence match.

### `POST /attendance/checkout`
- Employee-only.
- Multipart form with `selfie`, `latitude`, `longitude`, `address`, `liveness_score`.
- Closes the active session.

### `GET /attendance/`
- Returns attendance history.

## Assignments

### `GET /assignments/`
### `POST /assignments/`
### `PUT /assignments/{id}/`
- Admin-only assignment CRUD.

## Location

### `POST /location/update`
- Employee-only.
- Stores background GPS points for the current session.

### `GET /location/employee/current-location/{id}`
### `GET /location/employee/route/{id}`
### `GET /location/employee/travel-history/{id}`
- Admin-only unless the caller is the same employee.

## Employees

### `GET /employees/`
### `GET /employees/{id}/`
### `POST /employees/`
### `PUT /employees/{id}/`
### `DELETE /employees/{id}/`
- Admin-only employee management.

## Dashboard

### `GET /dashboard/metrics`
- Admin-only KPI summary for present employees, active sessions, completed visits, pending visits, and daily distance.
