/**
 * Color Constants for UI Badges and Status Indicators
 * Ensures consistency across the application
 */

export const STATUS_COLORS = {
    'new': '#6B7280',        // Gray
    'assigned': '#3B82F6',   // Blue
    'in_progress': '#F59E0B',  // Amber/Orange
    'pending_certification': '#8B5CF6',  // Purple
    'closed': '#10B981'      // Green
};

export const STATUS_BADGES = {
    'new': { bg: '#F3F4F6', text: '#374151', icon: 'fas fa-circle' },
    'assigned': { bg: '#DBEAFE', text: '#1E40AF', icon: 'fas fa-circle-check' },
    'in_progress': { bg: '#FEF3C7', text: '#92400E', icon: 'fas fa-spinner' },
    'pending_certification': { bg: '#EDE9FE', text: '#5B21B6', icon: 'fas fa-hourglass-half' },
    'closed': { bg: '#D1FAE5', text: '#065F46', icon: 'fas fa-check-circle' }
};

export const PRIORITY_COLORS = {
    'critical': '#DC2626',   // Red
    'high': '#EA580C',       // Orange-Red
    'medium': '#CA8A04',     // Amber
    'low': '#16A34A'         // Green
};

export const PRIORITY_BADGES = {
    'critical': { bg: '#FEE2E2', text: '#991B1B', icon: 'fas fa-alert' },
    'high': { bg: '#FFEDD5', text: '#7C2D12', icon: 'fas fa-exclamation' },
    'medium': { bg: '#FEF08A', text: '#713F12', icon: 'fas fa-info-circle' },
    'low': { bg: '#DCFCE7', text: '#14532D', icon: 'fas fa-check' }
};

export const getStatusColor = (status) => STATUS_COLORS[status] || '#6B7280';
export const getPriorityColor = (priority) => PRIORITY_COLORS[priority.toLowerCase()] || '#CA8A04';
export const getStatusBadge = (status) => STATUS_BADGES[status] || STATUS_BADGES.new;
export const getPriorityBadge = (priority) => PRIORITY_BADGES[priority.toLowerCase()] || PRIORITY_BADGES.medium;
