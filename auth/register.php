<?php
// auth/register.php - SIMPLE VERSION FOR YOUR DATABASE
error_reporting(E_ALL);
ini_set('display_errors', 1);
session_start();

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Include database connection
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

// Get form data
$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$password = $_POST['password'] ?? '';
$confirmPassword = $_POST['password_confirmation'] ?? '';

// Simple validation
if (empty($name) || empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'error' => 'All fields are required']);
    exit;
}

if ($password !== $confirmPassword) {
    echo json_encode(['success' => false, 'error' => 'Passwords do not match']);
    exit;
}

if (strlen($password) < 6) {
    echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
    exit;
}

try {
    // Connect to database
    $conn = getDBConnection();
    
    // Check if email already exists
    $checkStmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $checkStmt->bind_param("s", $email);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['success' => false, 'error' => 'Email already exists']);
        exit;
    }
    
    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
    
    // Insert user - USING YOUR EXACT COLUMN NAMES
    $insertStmt = $conn->prepare("INSERT INTO users (name, email, password, status) VALUES (?, ?, ?, 'active')");
    $insertStmt->bind_param("sss", $name, $email, $hashedPassword);
    
    if ($insertStmt->execute()) {
        $userId = $conn->insert_id;
        
        // Create user preferences
        $prefStmt = $conn->prepare("INSERT INTO user_preferences (user_id, preferences_json) VALUES (?, ?)");
        $defaultPreferences = json_encode([
            'theme' => 'dark',
            'language' => 'en', 
            'color_filter' => 'normal',
            'tts_rate' => 1.0,
            'tts_pitch' => 1.0
        ]);
        $prefStmt->bind_param("is", $userId, $defaultPreferences);
        $prefStmt->execute();
        
        // Set session
        $_SESSION['user_id'] = $userId;
        $_SESSION['user_name'] = $name;
        $_SESSION['user_email'] = $email;
        
        echo json_encode([
            'success' => true,
            'message' => 'Registration successful!',
            'user' => [
                'id' => $userId,
                'name' => $name,
                'email' => $email
            ],
            'redirect' => 'home.html'
        ]);
        
    } else {
        throw new Exception('Database error: ' . $insertStmt->error);
    }
    
} catch (Exception $e) {
    error_log("Registration error: " . $e->getMessage());
    echo json_encode(['success' => false, 'error' => 'Registration failed: ' . $e->getMessage()]);
}
?>