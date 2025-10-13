<?php
session_start();

// Log the logout activity
if (isset($_SESSION['user_id'])) {
    error_log("User {$_SESSION['user_id']} logged out");
}

// Clear all session variables
$_SESSION = [];

// Delete session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy session
session_destroy();

header('Content-Type: application/json');
echo json_encode([
    'success' => true, 
    'message' => 'Logged out successfully',
    'redirect' => 'index.html'
]);
?>