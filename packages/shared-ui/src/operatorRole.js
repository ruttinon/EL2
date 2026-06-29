export const OPERATOR_ROLE_STORAGE_KEY = 'energylink.operatorRole';
const ROLES = ['viewer', 'operator', 'engineer'];
export function isOperatorRole(value) {
    return value === 'viewer' || value === 'operator' || value === 'engineer';
}
export function getOperatorRole() {
    if (typeof sessionStorage === 'undefined')
        return 'operator';
    const raw = sessionStorage.getItem(OPERATOR_ROLE_STORAGE_KEY);
    return isOperatorRole(raw) ? raw : 'operator';
}
export function setOperatorRole(role) {
    if (typeof sessionStorage === 'undefined')
        return;
    sessionStorage.setItem(OPERATOR_ROLE_STORAGE_KEY, role);
}
/** Apply ?role=viewer|operator|engineer from URL once on load. */
export function initOperatorRoleFromQuery() {
    if (typeof window === 'undefined')
        return 'operator';
    const role = new URLSearchParams(window.location.search).get('role');
    if (isOperatorRole(role)) {
        setOperatorRole(role);
        return role;
    }
    return getOperatorRole();
}
export const OPERATOR_ROLE_OPTIONS = [
    { id: 'viewer', label: 'Viewer' },
    { id: 'operator', label: 'Operator' },
    { id: 'engineer', label: 'Engineer' },
];
