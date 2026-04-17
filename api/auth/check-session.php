<?php
// api/auth/check-session.php - Check if user is logged in on main site
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

session_start();

try {
    if (isset($_SESSION['user_id']) && isset($_SESSION['email'])) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'isLoggedIn' => true,
            'user' => [
                'id' => $_SESSION['user_id'],
                'email' => $_SESSION['email'],
                'name' => $_SESSION['name'] ?? 'User'
            ]
        ]);
    } else {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'isLoggedIn' => false,
            'message' => 'User not logged in'
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Server error']);
}
?>
