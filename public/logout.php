<?php
// public/logout.php
header('Content-Type: application/json; charset=utf-8');

// Start session if not started
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// Clear session data
$_SESSION = [];

// If session uses cookies, clear cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destroy session
session_destroy();

// Return JSON success
echo json_encode(['ok' => true, 'message' => 'Logged out']);
exit;
?>