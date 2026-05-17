export const ROLE_LANDING_ROUTE = {
    line_attendant: '/portal/field',
    line_supervisor: '/portal/line-supervisor',
    stp_attendant: '/portal/attendant',
    stp_operator: '/portal/operator',
    lab_tech: '/portal/lab',
    stp_supervisor: '/portal/supervisor',
    stp_superintendent: '/portal/superintendent',
    admin: '/portal/admin',
};

export const getLandingRoute = (role) => {
    if (!role) return ROLE_LANDING_ROUTE.line_attendant;
    return ROLE_LANDING_ROUTE[role] || ROLE_LANDING_ROUTE.line_attendant;
};
