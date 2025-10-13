<?php
// auth/session-status.php - Session status endpoint for AJAX calls
session_start();
require_once __DIR__ . '/../includes/functions.php';

header('Content-Type: application/json');

// Handle preflight requests for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? 'status';

if ($action === 'status') {
    if (isLoggedIn()) {
        $user = getCurrentUser();
        echo json_encode([
            'authenticated' => true,
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email']
            ],
            'preferences' => $user['preferences'] ?? []
        ]);
    } else {
        echo json_encode([
            'authenticated' => false,
            'user' => null,
            'preferences' => []
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
}
?>