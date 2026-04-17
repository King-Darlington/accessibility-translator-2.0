<?php
// auth/login.php - SIMPLE VERSION FOR YOUR DATABASE
session_start();
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

// Detect if this is an AJAX request or form submission
$isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

// Set appropriate content type
if ($isAjax) {
    header('Content-Type: application/json');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    if ($isAjax) {
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    } else {
        header('Location: ../login.html');
    }
    exit;
}

// Get form data
$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';

// Validation
if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'error' => 'Email and password are required']);
    exit;
}

try {
    $conn = getDBConnection();
    
    // Find user - USING YOUR EXACT COLUMN NAMES
    $stmt = $conn->prepare("SELECT id, name, email, password FROM users WHERE email = ? AND status = 'active'");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
        exit;
    }

    // Verify password
    $user = $result->fetch_assoc();
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success' => false, 'error' => 'Invalid email or password']);
        exit;
    }

    // Update last login
    $updateStmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $updateStmt->bind_param("i", $user['id']);
    $updateStmt->execute();

    // Set session
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['user_email'] = $user['email'];

    // For AJAX requests, return JSON; for form submissions, redirect to home
    if ($isAjax) {
        echo json_encode([
            'success' => true, 
            'user' => [
                'id' => $user['id'], 
                'name' => $user['name'], 
                'email' => $user['email']
            ],
            'message' => 'Login successful',
            'redirect' => 'home.html'
        ]);
    } else {
        // Direct form submission: redirect to home.html
        header('Location: ../home.html');
        exit;
    }

} catch (Exception $e) {
    error_log("Login error: " . $e->getMessage());
    $errorMsg = 'Login failed: ' . $e->getMessage();
    if ($isAjax) {
        echo json_encode(['success' => false, 'error' => $errorMsg]);
    } else {
        // For form submissions, show error and redirect back
        $_SESSION['error'] = $errorMsg;
        header('Location: ../index.html');
        exit;
    }
}
?>