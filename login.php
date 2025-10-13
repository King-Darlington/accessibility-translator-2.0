<?php
// Start session
session_start();

// Include database connection
require_once 'database.php';

// Get form data
$email = $_POST['email'];
$password = $_POST['password'];

// Validate form data
if (empty($email) || empty($password)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email and password are required']);
    exit;
}

// Query database for user
$conn = getDBConnection();
$stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

// Check if user exists
if ($result->num_rows === 0) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// Verify password
$user = $result->fetch_assoc();
if (!password_verify($password, $user['password'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid email or password']);
    exit;
}

// Login successful, start session and redirect
$_SESSION['user_id'] = $user['id'];
$_SESSION['user_email'] = $user['email'];

http_response_code(200);
echo json_encode(['success' => true, 'user' => ['id' => $user['id'], 'email' => $user['email']]]);
?>