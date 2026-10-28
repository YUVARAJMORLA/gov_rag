const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticate = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// All admin routes strictly require valid JWT AND admin role
router.use(authenticate);
router.use(adminAuth);

// Connection Details & Diagnostics
router.get('/connections', adminController.getConnectionDetails);
router.get('/connections/test', adminController.testConnections);

// Databricks Unity Catalog Tables Info & Live Inspection
router.get('/tables', adminController.getTablesInformation);
router.get('/tables/data', adminController.getTableData);

// User Management (MongoDB Stored)
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/status', adminController.toggleUserStatus);
router.patch('/users/:userId/role', adminController.updateUserRole);

// Observability & System Analytics
router.get('/analytics', adminController.getAnalytics);
router.get('/dashboard-metrics', adminController.getDatabricksDashboardMetrics);

// Databricks Knowledge Graph Explorer
router.get('/knowledge-graph', adminController.getKnowledgeGraph);

module.exports = router;
